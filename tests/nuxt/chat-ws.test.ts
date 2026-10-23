// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { Peer } from 'crossws'
import {
  publishChatMessage,
  publishThreadCreated,
  subscribePeer,
  threadPeerCount,
  toWireMessage,
  toWireThread,
  unsubscribePeer,
} from '../../server/utils/chat/ws'

function fakePeer(userId = 'a') {
  const peer = { send: vi.fn(), context: { userId } } as unknown as Peer & {
    send: ReturnType<typeof vi.fn>
  }
  return peer
}

const row = {
  id: 1,
  threadId: 2,
  userId: 'a',
  plainTextBody: 'hello',
  createdAt: new Date('2026-10-23T12:00:00Z'),
}

const thread = {
  id: 9,
  projectId: 1,
  createdAt: new Date('2026-10-23T12:00:00Z'),
  closedAt: null,
}

describe('chat ws hub', () => {
  it('serializes messages and threads for the wire', () => {
    expect(toWireMessage(row)).toEqual({
      id: 1,
      threadId: 2,
      userId: 'a',
      plainTextBody: 'hello',
      createdAt: '2026-10-23T12:00:00.000Z',
    })
    expect(toWireThread(thread)).toEqual({
      id: 9,
      projectId: 1,
      createdAt: '2026-10-23T12:00:00.000Z',
      closedAt: null,
    })
  })

  it('delivers a message only to peers seeded into that thread', () => {
    const watching = fakePeer()
    const elsewhere = fakePeer()
    subscribePeer('a', [2], watching)
    subscribePeer('b', [3], elsewhere)

    publishChatMessage(2, toWireMessage(row))

    expect(watching.send).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ type: 'message.created', message: toWireMessage(row) }),
    )
    expect(elsewhere.send).not.toHaveBeenCalled()

    unsubscribePeer(watching)
    unsubscribePeer(elsewhere)
  })

  it('subscribes members of a new thread so later messages reach them', () => {
    const member = fakePeer('a')
    const outsider = fakePeer('c')
    subscribePeer('a', [], member)
    subscribePeer('c', [2], outsider)

    publishThreadCreated(thread, ['a', 'b'])

    expect(member.send).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({ type: 'thread.created', thread: toWireThread(thread) }),
    )
    expect(threadPeerCount(9)).toBe(1)

    publishChatMessage(9, toWireMessage({ ...row, threadId: 9 }))

    expect(member.send).toHaveBeenCalledTimes(2)
    expect(outsider.send).not.toHaveBeenCalled()

    unsubscribePeer(member)
    unsubscribePeer(outsider)
  })

  it('keeps fanning out when one peer is already closing', () => {
    const closing = {
      send: vi.fn(() => {
        throw new Error('socket closed')
      }),
      context: { userId: 'a' },
    } as unknown as Peer
    const healthy = fakePeer()
    subscribePeer('a', [2], closing)
    subscribePeer('a', [2], healthy)

    publishChatMessage(2, toWireMessage(row))

    expect(healthy.send).toHaveBeenCalledOnce()

    unsubscribePeer(closing)
    unsubscribePeer(healthy)
  })

  it('removes a peer from every thread and from the user index on close', () => {
    const peer = fakePeer('a')
    subscribePeer('a', [2, 4], peer)
    expect(threadPeerCount(2)).toBe(1)
    expect(threadPeerCount(4)).toBe(1)

    unsubscribePeer(peer)

    expect(threadPeerCount(2)).toBe(0)
    expect(threadPeerCount(4)).toBe(0)

    publishThreadCreated(thread, ['a'])
    expect(peer.send).not.toHaveBeenCalled()
  })
})
