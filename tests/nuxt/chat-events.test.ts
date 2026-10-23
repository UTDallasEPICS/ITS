// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessageEvent, ChatThreadCreatedEvent } from '../../server/utils/chat/events'
import {
  emitChatMessage,
  emitChatThreadCreated,
  onChatMessage,
  onChatThreadCreated,
} from '../../server/utils/chat/events'

const { listenersByHook, app } = vi.hoisted(() => {
  type Listener = (payload: unknown) => void | Promise<void>
  const listenersByHook = new Map<string, Set<Listener>>()

  const listenersFor = (name: string) => {
    let listeners = listenersByHook.get(name)
    if (!listeners) {
      listeners = new Set<Listener>()
      listenersByHook.set(name, listeners)
    }
    return listeners
  }

  return {
    listenersByHook,
    app: {
      hooks: {
        hook: (name: string, listener: Listener) => {
          const listeners = listenersFor(name)
          listeners.add(listener)
          return () => listeners.delete(listener)
        },
        callHook: async (name: string, payload: unknown) => {
          for (const listener of [...listenersFor(name)]) await listener(payload)
        },
      },
    },
  }
})

vi.mock('nitropack/runtime', () => ({ useNitroApp: () => app }))

const message = {
  id: 1,
  createdAt: new Date('2026-10-23T00:00:00Z'),
  threadId: 2,
  userId: 'a',
  plainTextBody: 'hello',
}

const thread = {
  id: 3,
  projectId: 1,
  createdAt: new Date('2026-10-23T00:00:00Z'),
  closedAt: null,
}

beforeEach(() => listenersByHook.clear())

describe('chat events', () => {
  it('delivers the persisted row to subscribers', async () => {
    const received: ChatMessageEvent[] = []
    onChatMessage((payload) => {
      received.push(payload)
    })

    await emitChatMessage(message)

    expect(received).toEqual([{ threadId: 2, message }])
  })

  it('stops delivering after unsubscribe', async () => {
    const listener = vi.fn()
    const unsubscribe = onChatMessage(listener)

    unsubscribe()
    await emitChatMessage(message)

    expect(listener).not.toHaveBeenCalled()
  })

  it('surfaces listener failures to the caller', async () => {
    onChatMessage(() => {
      throw new Error('fan-out down')
    })

    await expect(emitChatMessage(message)).rejects.toThrow('fan-out down')
  })

  it('delivers a new thread and its members to subscribers', async () => {
    const received: ChatThreadCreatedEvent[] = []
    onChatThreadCreated((payload) => {
      received.push(payload)
    })

    await emitChatThreadCreated(thread, ['a', 'b'])

    expect(received).toEqual([{ thread, memberIds: ['a', 'b'] }])
  })

  it('keeps the two channels separate', async () => {
    const messages = vi.fn()
    const threads = vi.fn()
    onChatMessage(messages)
    onChatThreadCreated(threads)

    await emitChatThreadCreated(thread, ['a'])
    await emitChatMessage(message)

    expect(messages).toHaveBeenCalledExactlyOnceWith({ threadId: 2, message })
    expect(threads).toHaveBeenCalledExactlyOnceWith({ thread, memberIds: ['a'] })
  })

  it('surfaces thread listener failures to the caller', async () => {
    onChatThreadCreated(() => {
      throw new Error('thread fan-out down')
    })

    await expect(emitChatThreadCreated(thread, ['a'])).rejects.toThrow('thread fan-out down')
  })
})
