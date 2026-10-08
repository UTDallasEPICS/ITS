// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineEventHandler, toWebHandler, type H3EventContext } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import { organization, project, user } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import projectsHandler from '../../server/api/projects/index.get'

// Replace the entire connection module before importing the handler. This never
// loads .env or opens dev.db; real queries run against a disposable memory database.
vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  return { db: drizzle(new Database(':memory:'), { schema }) }
})

migrate(db, { migrationsFolder: './drizzle' })
db.$client.pragma('foreign_keys = ON')

const sessionUser: NonNullable<H3EventContext['user']> = {
  id: 'partner-a',
  name: 'Test Partner',
  email: 'partner-a@example.com',
  emailVerified: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

// Supply the identity normally set by auth middleware. The real route and
// requireUser helper run through H3, without a server or network connection.
function request(identity: H3EventContext['user'] | null = sessionUser, query = '') {
  const app = createApp()
  app.use(
    defineEventHandler((event) => {
      event.context.user = identity ?? undefined
    })
  )
  app.use('/api/projects', projectsHandler)
  return toWebHandler(app)(new Request(`http://localhost/api/projects${query}`))
}

describe('GET /api/projects', () => {
  beforeEach(() => {
    db.delete(project).run()
    db.delete(user).run()
    db.delete(organization).run()
    db.insert(organization)
      .values([
        { id: 'org-a', name: 'Partner A' },
        { id: 'org-b', name: 'Partner B' },
        { id: 'org-empty', name: 'Partner without projects' },
      ])
      .run()
    db.insert(user)
      .values([
        { id: 'partner-a', name: 'Partner A', email: 'a@example.com', orgId: 'org-a' },
        { id: 'partner-b', name: 'Partner B', email: 'b@example.com', orgId: 'org-b' },
        { id: 'npts', name: 'NPTS Member', email: 'npts@example.com', orgId: null },
        { id: 'empty', name: 'Empty', email: 'empty@example.com', orgId: 'org-empty' },
      ])
      .run()
    db.insert(project)
      .values([
        { id: 1, name: 'Zebra', githubRepo: 'example/zebra', projectPartnerId: 'org-a' },
        { id: 2, name: 'Alpha', githubRepo: 'example/alpha', projectPartnerId: 'org-a' },
        { id: 3, name: 'Private B', githubRepo: 'example/private-b', projectPartnerId: 'org-b' },
      ])
      .run()
  })

  afterAll(() => {
    db.$client.close()
  })

  it('rejects a signed-out request with 401', async () => {
    const response = await request(null)
    expect(response.status).toBe(401)
  })

  it('returns only the partner’s projects, sorted, with only IDs and names', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([
      { id: 2, name: 'Alpha' },
      { id: 1, name: 'Zebra' },
    ])

    const otherPartner = await request({ ...sessionUser, id: 'partner-b' })
    expect(await otherPartner.json()).toEqual([{ id: 3, name: 'Private B' }])
  })

  it('ignores attempts to select another user or organization in the query', async () => {
    const response = await request(
      sessionUser,
      '?orgId=org-b&projectPartnerId=org-b&userId=partner-b'
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([
      { id: 2, name: 'Alpha' },
      { id: 1, name: 'Zebra' },
    ])
  })

  it('uses the current database assignment after a partner changes organization', async () => {
    db.update(user).set({ orgId: 'org-b' }).where(eq(user.id, sessionUser.id)).run()
    const response = await request()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([{ id: 3, name: 'Private B' }])
  })

  it('lists all organizations’ projects for an existing NPTS user with no org', async () => {
    const response = await request({ ...sessionUser, id: 'npts' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([
      { id: 2, name: 'Alpha' },
      { id: 3, name: 'Private B' },
      { id: 1, name: 'Zebra' },
    ])
  })

  it('restricts a former NPTS user after assignment to a partner organization', async () => {
    db.update(user).set({ orgId: 'org-b' }).where(eq(user.id, 'npts')).run()
    const response = await request({ ...sessionUser, id: 'npts' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([{ id: 3, name: 'Private B' }])
  })

  it('does not mistake a deleted NPTS account for a user with a null org', async () => {
    db.delete(user).where(eq(user.id, 'npts')).run()
    const response = await request({ ...sessionUser, id: 'npts' })
    expect(response.status).toBe(403)
  })

  it('rejects an identity whose user has been deleted', async () => {
    db.delete(user).where(eq(user.id, sessionUser.id)).run()
    const response = await request()
    expect(response.status).toBe(403)
  })

  it('returns an empty list for a partner with no projects', async () => {
    const response = await request({ ...sessionUser, id: 'empty' })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([])
  })
})
