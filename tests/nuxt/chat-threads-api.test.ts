// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, defineEventHandler, toWebHandler, type H3EventContext } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import {
  chatThreadMembers,
  chatThreadMessages,
  chatThreads,
  organization,
  project,
  user,
} from '../../server/db/schema'
import { db } from '../../server/utils/db'
import threadsHandler from '../../server/api/chat/threads/index.get'

vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  return { db: drizzle(new Database(':memory:'), { schema }) }
})

migrate(db, { migrationsFolder: './drizzle' })
db.$client.pragma('foreign_keys = ON')

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

  const router = createRouter()
  router.get('/api/chat/threads', threadsHandler)
  app.use(router)

  return toWebHandler(app)(new Request(`http://localhost/api/chat/threads${query}`))
}

async function list(response: Response) {
  const body = await response.json()
  return {
    ids: body.threads.map((thread: { id: number }) => thread.id) as number[],
    metadata: body.metadata,
  }
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
    .values([
      { id: 1, name: 'Project 1', githubRepo: 'example/1', projectPartnerId: 'org' },
      { id: 2, name: 'Project 2', githubRepo: 'example/2', projectPartnerId: 'other' },
    ])
    .run()
  db.insert(user)
    .values([
      { id: 'member', name: 'Member', email: 'member@example.com', orgId: 'org' },
      { id: 'peer', name: 'Peer', email: 'peer@example.com', orgId: 'org' },
      { id: 'npts', name: 'NPTS', email: 'npts@example.com' },
    ])
    .run()

  db.insert(chatThreads)
    .values([
      { id: 1, projectId: 1 },
      { id: 2, projectId: 1 },
      { id: 3, projectId: 2 },
      { id: 4, projectId: 1 },
    ])
    .run()
  db.insert(chatThreadMembers)
    .values([
      { threadId: 1, userId: 'member' },
      { threadId: 2, userId: 'peer' },
      { threadId: 3, userId: 'member' },
      { threadId: 4, userId: 'npts' },
    ])
    .run()
})

afterAll(() => db.$client.close())

describe('GET /api/chat/threads', () => {
  it('returns the threads the caller was added to, ascending by id', async () => {
    const response = await request()

    expect(response.status).toBe(200)
    expect(await list(response)).toEqual({ ids: [1, 3], metadata: { hasMore: false } })
  })

  it('pages forward from an exclusive after cursor', async () => {
    const response = await request('?after=1&pageSize=1')

    expect(await list(response)).toEqual({ ids: [3], metadata: { hasMore: false } })
  })

  it('reports hasMore when another page follows', async () => {
    const response = await request('?pageSize=1')

    expect(await list(response)).toEqual({ ids: [1], metadata: { hasMore: true } })
  })

  it('scopes to membership rather than to project access', async () => {
    expect(await list(await request('', 'peer'))).toEqual({ ids: [2], metadata: { hasMore: false } })
  })

  it('does not stream every thread to NPTS', async () => {
    expect(await list(await request('', 'npts'))).toEqual({ ids: [4], metadata: { hasMore: false } })
  })

  it('returns an empty page for a user with no threads', async () => {
    db.delete(chatThreadMembers).where(eq(chatThreadMembers.userId, 'member')).run()

    expect(await list(await request())).toEqual({ ids: [], metadata: { hasMore: false } })
  })

  it('rejects out-of-range and malformed pagination', async () => {
    for (const query of ['?pageSize=0', '?pageSize=26', '?after=abc', '?after=-1']) {
      const response = await request(query)
      expect(response.status).toBe(400)
    }
  })
})
