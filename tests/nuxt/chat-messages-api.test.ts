// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, defineEventHandler, toWebHandler, type H3EventContext } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import {
  chatThreadMembers,
  chatThreadMessages,
  chatThreads,
  organization,
  project,
  user,
} from '../../server/db/schema'
import { db } from '../../server/utils/db'
import messagesHandler from '../../server/api/chat/threads/[threadId]/messages.get'

// The route, guard, and service all run for real against a disposable memory
// database; only the connection module and the session middleware are replaced.
vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  return { db: drizzle(new Database(':memory:'), { schema }) }
})

migrate(db, { migrationsFolder: './drizzle' })
db.$client.pragma('foreign_keys = ON')

let threadId: number
let messages: { id: number }[]

function sessionUser(id: string): NonNullable<H3EventContext['user']> {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

function request(query = '', userId = 'member') {
  const app = createApp()
  app.use(
    defineEventHandler((event) => {
      event.context.user = sessionUser(userId)
    })
  )

  // A router (rather than a prefix mount) is what populates the :threadId
  // router param the handler reads.
  const router = createRouter()
  router.get('/api/chat/threads/:threadId/messages', messagesHandler)
  app.use(router)

  return toWebHandler(app)(
    new Request(`http://localhost/api/chat/threads/${threadId}/messages${query}`)
  )
}

beforeEach(() => {
  db.delete(chatThreadMessages).run()
  db.delete(chatThreadMembers).run()
  db.delete(chatThreads).run()
  db.delete(project).run()
  db.delete(user).run()
  db.delete(organization).run()

  db.insert(organization)
    .values([
      { id: 'org', name: 'Partner' },
      { id: 'other', name: 'Other partner' },
    ])
    .run()
  db.insert(project)
    .values({ id: 1, name: 'Project 1', githubRepo: 'example/1', projectPartnerId: 'org' })
    .run()
  db.insert(user)
    .values([
      { id: 'member', name: 'Member', email: 'member@example.com', orgId: 'org' },
      { id: 'peer', name: 'Peer', email: 'peer@example.com', orgId: 'org' },
    ])
    .run()

  threadId = db.insert(chatThreads).values({ projectId: 1 }).returning().get()!.id
  db.insert(chatThreadMembers).values({ threadId, userId: 'member' }).run()
  messages = db
    .insert(chatThreadMessages)
    .values(
      Array.from({ length: 5 }, (_, index) => ({
        threadId,
        userId: 'member',
        plainTextBody: `Message ${index + 1}`,
      }))
    )
    .returning()
    .all()
})

afterAll(() => db.$client.close())

describe('GET /api/chat/threads/:threadId/messages', () => {
  it('opens on the newest page when no cursor is given', async () => {
    const body = await (await request('?pageSize=2')).json()

    expect(body.messages.map((message: { id: number }) => message.id)).toEqual(
      messages.slice(-2).map((message) => message.id)
    )
    expect(body.metadata).toEqual({ hasMore: true })
  })

  it('pages backward with before for infinite scroll', async () => {
    const newest = await (await request('?pageSize=2')).json()
    const older = await (
      await request(`?pageSize=2&before=${newest.messages[0].id}`)
    ).json()
    const oldest = await (
      await request(`?pageSize=2&before=${older.messages[0].id}`)
    ).json()

    expect(newest.messages.map((message: { id: number }) => message.id)).toEqual([4, 5])
    expect(older.messages.map((message: { id: number }) => message.id)).toEqual([2, 3])
    expect(oldest.messages.map((message: { id: number }) => message.id)).toEqual([1])
    expect([newest.metadata.hasMore, older.metadata.hasMore, oldest.metadata.hasMore]).toEqual([
      true,
      true,
      false,
    ])
  })

  it('pages forward with after for reconnect catch-up', async () => {
    const body = await (await request('?after=2&pageSize=2')).json()

    expect(body.messages.map((message: { id: number }) => message.id)).toEqual([3, 4])
    expect(body.metadata).toEqual({ hasMore: true })
  })

  it('rejects both cursors at once', async () => {
    const response = await request('?after=1&before=5')

    expect(response.status).toBe(400)
    const body = await response.json()
    // h3 v1 exposes statusMessage, the v2 RC exposes message.
    expect(body.message ?? body.statusMessage).toBe('Invalid pagination parameters')
  })

  it('rejects an out-of-range page size', async () => {
    const response = await request('?pageSize=26')

    expect(response.status).toBe(400)
  })

  it('hides the thread from a same-org partner who is not a member', async () => {
    const response = await request('', 'peer')

    expect(response.status).toBe(404)
  })
})
