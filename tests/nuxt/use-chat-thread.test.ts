// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { useChatThread } from '../../app/composables/useChatThread'
import type { ChatAdapter, ChatMessagePage, ChatSubscriptionHandlers } from '../../app/types/chat'
import type { ChatWireMessage } from '../../shared/types/chat'

function wireMessage(id: number, plainTextBody = `message ${id}`, userId = 'a'): ChatWireMessage {
  return {
    id,
    threadId: 1,
    userId,
    plainTextBody,
    createdAt: '2026-10-23T12:00:00.000Z',
  }
}

function page(messages: ChatWireMessage[]): ChatMessagePage {
  return { messages, metadata: { hasMore: false } }
}

function createAdapter() {
  const loadMessages = vi.fn(async (): Promise<ChatMessagePage> => page([]))
  const sendMessage = vi.fn(async (body: string) => wireMessage(99, body))
  const adapter: ChatAdapter = { loadMessages, sendMessage }
  return { adapter, loadMessages, sendMessage }
}

function addSubscription(adapter: ChatAdapter) {
  let handlers: ChatSubscriptionHandlers | undefined
  const unsubscribe = vi.fn(() => {
    handlers = undefined
  })

  adapter.subscribe = vi.fn((next) => {
    handlers = next
    next.onStatusChange?.('live')
    return unsubscribe
  })

  return {
    get handlers() {
      return handlers
    },
    unsubscribe,
  }
}

describe('useChatThread', () => {
  it('starts listening before it loads history so nothing is missed', async () => {
    const { adapter, loadMessages } = createAdapter()
    loadMessages.mockResolvedValueOnce(page([wireMessage(2), wireMessage(1)]))
    const subscribe = vi.fn((next: ChatSubscriptionHandlers) => {
      next.onStatusChange?.('live')
      return () => {}
    })
    adapter.subscribe = subscribe

    const thread = useChatThread(adapter)
    await thread.start()

    expect(thread.loadState.value).toBe('ready')
    expect(thread.messages.value.map((message) => message.id)).toEqual([1, 2])
    expect(subscribe).toHaveBeenCalledOnce()
    expect(subscribe.mock.invocationCallOrder[0]).toBeLessThan(
      loadMessages.mock.invocationCallOrder[0]!
    )
    expect(thread.connection.value).toBe('live')
  })

  it('keeps a message that arrives while history is loading', async () => {
    const { adapter, loadMessages } = createAdapter()
    let resolveLoad!: (value: ChatMessagePage) => void
    loadMessages.mockReturnValueOnce(
      new Promise<ChatMessagePage>((resolve) => {
        resolveLoad = resolve
      })
    )
    const subscription = addSubscription(adapter)

    const thread = useChatThread(adapter)
    const starting = thread.start()

    subscription.handlers?.onMessage(wireMessage(2, 'early'))
    resolveLoad(page([wireMessage(1)]))
    await starting

    expect(thread.messages.value.map((message) => message.id)).toEqual([1, 2])
  })

  it('reports a failed load and recovers on retry', async () => {
    const { adapter, loadMessages } = createAdapter()
    loadMessages.mockRejectedValueOnce(new Error('offline'))
    loadMessages.mockResolvedValueOnce(page([wireMessage(1)]))
    const subscription = addSubscription(adapter)

    const thread = useChatThread(adapter)
    await thread.start()

    expect(thread.loadState.value).toBe('error')
    expect(thread.loadError.value).toContain('could not load')
    // A failed start must not leave a socket behind.
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()

    await thread.retry()

    expect(thread.loadState.value).toBe('ready')
    expect(thread.messages.value).toHaveLength(1)
    expect(adapter.subscribe).toHaveBeenCalledTimes(2)
  })

  it('appends live messages and ignores its own echo', async () => {
    const { adapter, loadMessages, sendMessage } = createAdapter()
    loadMessages.mockResolvedValueOnce(page([wireMessage(1)]))
    sendMessage.mockResolvedValueOnce(wireMessage(2, 'reply'))
    const subscription = addSubscription(adapter)

    const thread = useChatThread(adapter)
    await thread.start()
    await thread.sendMessage('reply')

    // The socket echoes the message the POST already returned.
    subscription.handlers?.onMessage(wireMessage(2, 'reply'))
    subscription.handlers?.onMessage(wireMessage(3, 'from someone else'))

    expect(thread.messages.value.map((message) => message.id)).toEqual([1, 2, 3])
  })

  it('reports send failures without dropping the conversation', async () => {
    const { adapter, loadMessages, sendMessage } = createAdapter()
    loadMessages.mockResolvedValueOnce(page([wireMessage(1)]))
    sendMessage.mockRejectedValueOnce(new Error('network down'))
    addSubscription(adapter)

    const thread = useChatThread(adapter)
    await thread.start()

    await expect(thread.sendMessage('hello')).resolves.toBe(false)
    expect(thread.sendError.value).toContain('draft is still here')
    expect(thread.messages.value).toHaveLength(1)
    expect(thread.sending.value).toBe(false)
  })

  it('does not call the adapter for blank or in-flight messages', async () => {
    const { adapter, sendMessage } = createAdapter()
    const thread = useChatThread(adapter)

    await expect(thread.sendMessage('   ')).resolves.toBe(false)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('catches up from the last seen id after a reconnect', async () => {
    const { adapter, loadMessages } = createAdapter()
    loadMessages.mockResolvedValueOnce(page([wireMessage(1), wireMessage(2)]))
    loadMessages.mockResolvedValueOnce(page([wireMessage(3)]))
    const subscription = addSubscription(adapter)

    const thread = useChatThread(adapter)
    await thread.start()
    await subscription.handlers?.onResync?.()

    expect(loadMessages).toHaveBeenLastCalledWith({ after: 2 })
    expect(thread.messages.value.map((message) => message.id)).toEqual([1, 2, 3])
  })

  it('surfaces connection transitions from the adapter', async () => {
    const { adapter } = createAdapter()
    const subscription = addSubscription(adapter)

    const thread = useChatThread(adapter)
    await thread.start()
    expect(thread.connection.value).toBe('live')

    subscription.handlers?.onStatusChange?.('reconnecting')
    expect(thread.connection.value).toBe('reconnecting')

    subscription.handlers?.onStatusChange?.('offline')
    expect(thread.connection.value).toBe('offline')
  })

  it('unsubscribes when stopped so a stale feed cannot add messages', async () => {
    const { adapter } = createAdapter()
    const subscription = addSubscription(adapter)

    const thread = useChatThread(adapter)
    await thread.start()
    thread.stop()

    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
  })

  it('stays usable with a snapshot-only adapter', async () => {
    const { adapter, loadMessages } = createAdapter()
    loadMessages.mockResolvedValueOnce(page([wireMessage(1)]))

    const thread = useChatThread(adapter)
    await thread.start()

    expect(thread.loadState.value).toBe('ready')
    expect(thread.connection.value).toBe('offline')
  })
})
