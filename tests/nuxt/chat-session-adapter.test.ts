// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionChatFetcher } from '../../app/utils/chat-session-adapter'
import { createSessionChatAdapter } from '../../app/utils/chat-session-adapter'
import type { ChatMessagePage, ChatSubscriptionHandlers } from '../../app/types/chat'

class FakeSocket {
  private listeners = new Map<string, Set<(event: never) => void>>()
  closed = false

  constructor(readonly url: string) {}

  addEventListener(type: string, listener: (event: never) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  emit(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event as never)
    }
  }

  open() {
    this.emit('open')
  }

  close() {
    this.closed = true
    this.emit('close')
  }

  receive(frame: unknown) {
    this.emit('message', { data: JSON.stringify(frame) })
  }
}

const emptyPage: ChatMessagePage = { messages: [], metadata: { hasMore: false } }

function socketFactory() {
  const sockets: FakeSocket[] = []
  return {
    sockets,
    createSocket: (url: string) => {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket as unknown as WebSocket
    },
  }
}

function handlers(): Required<ChatSubscriptionHandlers> {
  return { onMessage: vi.fn(), onStatusChange: vi.fn(), onResync: vi.fn() }
}

function message(id: number, threadId: number) {
  return {
    id,
    threadId,
    userId: 'a',
    plainTextBody: `message ${id}`,
    createdAt: '2026-10-23T12:00:00.000Z',
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createSessionChatAdapter', () => {
  it('loads history with an exclusive after cursor', async () => {
    const fetcher = vi.fn<SessionChatFetcher>(async () => emptyPage)
    const adapter = createSessionChatAdapter(7, { fetchImpl: fetcher })

    await adapter.loadMessages()
    await adapter.loadMessages({ after: 4 })

    expect(fetcher.mock.calls[0]).toEqual(['/api/chat/threads/7/messages', undefined])
    expect(fetcher.mock.calls[1]).toEqual(['/api/chat/threads/7/messages', { query: { after: 4 } }])
  })

  it('posts only the message body, never the author', async () => {
    const fetcher = vi.fn<SessionChatFetcher>(async () => emptyPage)
    const adapter = createSessionChatAdapter(7, { fetchImpl: fetcher })

    await adapter.sendMessage('hello there')

    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/api/chat/threads/7/messages', {
      method: 'POST',
      body: { plainTextBody: 'hello there' },
    })
  })

  it('connects to the secure session socket and reports progress', () => {
    const { sockets, createSocket } = socketFactory()
    const adapter = createSessionChatAdapter(7, {
      origin: 'https://its.example.com',
      createSocket,
    })
    const subscription = handlers()

    adapter.subscribe?.(subscription)

    expect(sockets[0]?.url).toBe('wss://its.example.com/api/chat/ws')
    expect(subscription.onStatusChange).toHaveBeenLastCalledWith('connecting')

    sockets[0]?.open()
    expect(subscription.onStatusChange).toHaveBeenLastCalledWith('live')

    adapter.subscribe?.(handlers())
  })

  it('forwards messages for its own thread and drops the rest of the session feed', () => {
    const { sockets, createSocket } = socketFactory()
    const adapter = createSessionChatAdapter(7, {
      origin: 'https://its.example.com',
      createSocket,
    })
    const subscription = handlers()

    adapter.subscribe?.(subscription)
    sockets[0]?.open()
    sockets[0]?.receive({ type: 'ready' })
    sockets[0]?.receive({ type: 'ping' })
    sockets[0]?.receive({ type: 'thread.created', thread: { id: 9 } })
    sockets[0]?.receive({ type: 'message.created', message: message(2, 8) })
    sockets[0]?.receive({ type: 'message.created', message: message(1, 7) })

    expect(subscription.onMessage).toHaveBeenCalledExactlyOnceWith(message(1, 7))
  })

  it('shares one socket across adapters and routes each thread its own frames', () => {
    const { sockets, createSocket } = socketFactory()
    const first = handlers()
    const second = handlers()

    createSessionChatAdapter(7, { origin: 'https://its.example.com', createSocket }).subscribe?.(first)
    createSessionChatAdapter(8, { origin: 'https://its.example.com', createSocket }).subscribe?.(second)

    expect(sockets).toHaveLength(1)

    sockets[0]?.open()
    sockets[0]?.receive({ type: 'message.created', message: message(1, 7) })
    sockets[0]?.receive({ type: 'message.created', message: message(2, 8) })

    expect(first.onMessage).toHaveBeenCalledExactlyOnceWith(message(1, 7))
    expect(second.onMessage).toHaveBeenCalledExactlyOnceWith(message(2, 8))
  })

  it('tells a late subscriber the connection is already live', () => {
    const { sockets, createSocket } = socketFactory()
    const unsubscribeFirst = createSessionChatAdapter(7, {
      origin: 'https://its.example.com',
      createSocket,
    }).subscribe?.(handlers())

    sockets[0]?.open()

    const late = handlers()
    const unsubscribeLate = createSessionChatAdapter(8, {
      origin: 'https://its.example.com',
      createSocket,
    }).subscribe?.(late)

    expect(late.onStatusChange).toHaveBeenLastCalledWith('live')
    expect(sockets).toHaveLength(1)

    unsubscribeFirst?.()
    unsubscribeLate?.()
    expect(sockets[0]?.closed).toBe(true)
  })

  it('keeps the socket open until the last subscriber leaves', () => {
    const { sockets, createSocket } = socketFactory()
    const unsubscribeFirst = createSessionChatAdapter(7, {
      origin: 'https://its.example.com',
      createSocket,
    }).subscribe?.(handlers())
    const unsubscribeSecond = createSessionChatAdapter(8, {
      origin: 'https://its.example.com',
      createSocket,
    }).subscribe?.(handlers())

    sockets[0]?.open()
    unsubscribeFirst?.()

    expect(sockets[0]?.closed).toBe(false)

    unsubscribeSecond?.()
    expect(sockets[0]?.closed).toBe(true)
  })

  it('reconnects with backoff and asks each thread for the missed messages', () => {
    const { sockets, createSocket } = socketFactory()
    const first = handlers()
    const second = handlers()

    createSessionChatAdapter(7, { origin: 'https://its.example.com', createSocket }).subscribe?.(first)
    createSessionChatAdapter(8, { origin: 'https://its.example.com', createSocket }).subscribe?.(second)

    sockets[0]?.open()
    sockets[0]?.close()
    expect(first.onStatusChange).toHaveBeenLastCalledWith('reconnecting')
    expect(second.onStatusChange).toHaveBeenLastCalledWith('reconnecting')
    expect(first.onResync).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1_000)
    expect(sockets).toHaveLength(2)

    sockets[1]?.open()
    expect(first.onStatusChange).toHaveBeenLastCalledWith('live')
    expect(first.onResync).toHaveBeenCalledOnce()
    expect(second.onResync).toHaveBeenCalledOnce()
  })

  it('stops reconnecting after the caller unsubscribes', () => {
    const { sockets, createSocket } = socketFactory()
    const adapter = createSessionChatAdapter(7, {
      origin: 'https://its.example.com',
      createSocket,
    })

    const unsubscribe = adapter.subscribe?.(handlers())
    sockets[0]?.close()
    unsubscribe?.()

    vi.advanceTimersByTime(60_000)

    expect(sockets).toHaveLength(1)
    expect(sockets[0]?.closed).toBe(true)
  })
})
