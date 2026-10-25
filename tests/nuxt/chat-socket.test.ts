// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { createServer } from 'node:http'
import { once } from 'node:events'
import nodeAdapter from 'crossws/adapters/node'
import type { Peer } from 'crossws'
import { chatThreadMembers, chatThreads, organization, project, user } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import { auth } from '../../server/utils/auth'
import { chatSocketHooks } from '../../server/utils/chat/socket'
import {
  publishChatMessage,
  publishThreadCreated,
  stopHeartbeat,
  threadPeerCount,
  unsubscribePeer,
} from '../../server/utils/chat/ws'

vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  return { db: drizzle(new Database(':memory:'), { schema }) }
})

vi.mock('../../server/utils/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}))

migrate(db, { migrationsFolder: './drizzle' })
db.$client.pragma('foreign_keys = ON')

function upgradeRequest() {
  return Object.assign(new Request('http://localhost/api/chat/ws'), { context: {} })
}

function fakePeer(context: Record<string, unknown> = {}) {
  return {
    send: vi.fn(),
    close: vi.fn(),
    context,
  } as unknown as Peer & { send: ReturnType<typeof vi.fn>, close: ReturnType<typeof vi.fn> }
}

const wireMessage = {
  id: 1,
  threadId: 1,
  userId: 'member',
  plainTextBody: 'hello',
  createdAt: '2026-10-23T12:00:00.000Z',
}

beforeEach(() => {
  vi.mocked(auth.api.getSession).mockReset()
  db.delete(chatThreadMembers).run()
  db.delete(chatThreads).run()
  db.delete(project).run()
  db.delete(user).run()
  db.delete(organization).run()

  db.insert(organization).values({ id: 'org', name: 'Partner' }).run()
  db.insert(project)
    .values({ id: 1, name: 'Project 1', githubRepo: 'example/1', projectPartnerId: 'org' })
    .run()
  db.insert(user)
    .values([
      { id: 'member', name: 'Member', email: 'member@example.com', orgId: 'org' },
      { id: 'other', name: 'Other', email: 'other@example.com', orgId: 'org' },
    ])
    .run()
  db.insert(chatThreads).values([{ id: 1, projectId: 1 }, { id: 2, projectId: 1 }]).run()
  db.insert(chatThreadMembers)
    .values([
      { threadId: 1, userId: 'member' },
      { threadId: 2, userId: 'other' },
    ])
    .run()
})

afterAll(() => db.$client.close())

describe('chat socket upgrade', () => {
  it('rejects a handshake without a session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null)

    const response = await chatSocketHooks.upgrade!(upgradeRequest())

    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(401)
  })

  it('seeds the adapter-provided context with only the session user’s threads', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'member' } } as never)

    const request = upgradeRequest()
    const response = await chatSocketHooks.upgrade!(request)

    expect(response).toBeUndefined()
    expect(request.context).toEqual({ userId: 'member', threadIds: [1] })
  })

  it('preserves authentication context through a real Node adapter handshake', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: 'member' } } as never)
    let connectedPeer: Peer | undefined
    let resolvePeerClosed!: () => void
    const peerClosed = new Promise<void>(resolve => { resolvePeerClosed = resolve })
    const adapter = nodeAdapter({ hooks: {
      ...chatSocketHooks,
      open(peer) {
        connectedPeer = peer
        return chatSocketHooks.open!(peer)
      },
      close(peer, details) {
        chatSocketHooks.close!(peer, details)
        resolvePeerClosed()
      },
    } })
    const server = createServer()
    server.on('upgrade', (request, socket, head) => { void adapter.handleUpgrade(request, socket, head) })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Missing test server port')
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/chat/ws`)

    function nextFrame() {
      return new Promise<unknown>((resolve, reject) => {
        socket.addEventListener('message', event => resolve(JSON.parse(String(event.data))), { once: true })
        socket.addEventListener('close', event => reject(new Error(`Socket closed: ${event.code}`)), { once: true })
        socket.addEventListener('error', () => reject(new Error('Socket error')), { once: true })
      })
    }

    try {
      expect(await nextFrame()).toEqual({ type: 'ready' })
      expect(threadPeerCount(1)).toBe(1)
      expect(threadPeerCount(2)).toBe(0)
      const message = nextFrame()
      publishChatMessage(1, wireMessage)
      expect(await message).toEqual({ type: 'message.created', message: wireMessage })
    } finally {
      const closed = socket.readyState === WebSocket.CLOSED ? Promise.resolve() : once(socket, 'close')
      socket.close()
      adapter.closeAll(1000)
      await closed
      if (connectedPeer) await peerClosed
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
})

describe('chat socket open', () => {
  it('acknowledges the connection and receives only seeded threads', () => {
    const peer = fakePeer({ userId: 'member', threadIds: [1] })

    chatSocketHooks.open!(peer)

    expect(peer.send).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ type: 'ready' }))
    expect(threadPeerCount(1)).toBe(1)

    publishChatMessage(1, wireMessage)
    expect(peer.send).toHaveBeenCalledTimes(2)

    publishChatMessage(2, wireMessage)
    expect(peer.send).toHaveBeenCalledTimes(2)

    unsubscribePeer(peer)
    stopHeartbeat(peer)
  })

  it('adds the peer to a thread created after it connected', () => {
    const peer = fakePeer({ userId: 'member', threadIds: [1] })
    chatSocketHooks.open!(peer)

    publishThreadCreated(
      { id: 9, projectId: 1, createdAt: new Date('2026-10-23T12:00:00Z'), closedAt: null },
      ['member'],
    )

    expect(peer.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'thread.created',
        thread: {
          id: 9,
          projectId: 1,
          createdAt: '2026-10-23T12:00:00.000Z',
          closedAt: null,
        },
      }),
    )
    expect(threadPeerCount(9)).toBe(1)

    release(peer)
  })

  it('closes a peer whose session context did not survive the upgrade', () => {
    const peer = fakePeer()

    chatSocketHooks.open!(peer)

    expect(peer.close).toHaveBeenCalledExactlyOnceWith(4400, 'Missing session')
    expect(peer.send).not.toHaveBeenCalled()
  })

  it('answers an application ping with a pong', () => {
    const peer = fakePeer({ userId: 'member', threadIds: [] })
    chatSocketHooks.open!(peer)

    chatSocketHooks.message!(peer, {
      json: () => ({ type: 'ping' }),
    } as never)

    expect(peer.send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'pong' }))

    release(peer)
  })

  it('unsubscribes on both close and error', () => {
    const closing = fakePeer({ userId: 'member', threadIds: [1] })
    const failing = fakePeer({ userId: 'member', threadIds: [1] })
    chatSocketHooks.open!(closing)
    chatSocketHooks.open!(failing)
    expect(threadPeerCount(1)).toBe(2)

    chatSocketHooks.close!(closing, {})
    chatSocketHooks.error!(failing, {} as never)

    expect(threadPeerCount(1)).toBe(0)
  })
})

function release(peer: Peer) {
  unsubscribePeer(peer)
  stopHeartbeat(peer)
}
