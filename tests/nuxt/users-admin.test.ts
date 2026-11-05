// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createError, defineEventHandler, toWebHandler, type EventHandler, type H3EventContext } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import { organization, session, user } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import createUser from '../../server/api/users/index.post'
import patchUser from '../../server/api/users/[id].patch'
import deleteUser from '../../server/api/users/[id].delete'

vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  return { db: drizzle(new Database(':memory:'), { schema }) }
})

migrate(db, { migrationsFolder: './drizzle' })
db.$client.pragma('foreign_keys = ON')

type Identity = NonNullable<H3EventContext['user']>

function identity(id: string): Identity {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    emailVerified: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  }
}

function call(
  handler: EventHandler,
  path: string,
  as: Identity | null,
  init?: RequestInit,
) {
  const app = createApp()
  app.use(
    defineEventHandler((event) => {
      event.context.user = as ?? undefined
      const id = path.split('/')[3]
      if (id) event.context.params = { id }
    }),
  )
  app.use('/api/users', handler)
  app.use(
    defineEventHandler(() => {
      throw createError({ statusCode: 405, statusMessage: 'Method not allowed' })
    }),
  )
  return toWebHandler(app)(new Request(`http://localhost${path}`, init))
}

beforeEach(() => {
  db.delete(session).run()
  db.delete(user).run()
  db.delete(organization).run()
  db.insert(organization)
    .values([
      { id: 'org-a', name: 'Partner A' },
      { id: 'org-b', name: 'Partner B' },
    ])
    .run()
  db.insert(user)
    .values([
      { id: 'admin', name: 'Admin', email: 'admin@example.com', orgId: null },
      { id: 'other-admin', name: 'Other Admin', email: 'other@example.com', orgId: null },
      { id: 'partner', name: 'Partner', email: 'partner@example.com', orgId: 'org-a' },
      { id: 'archived', name: 'Archived', email: 'archived@example.com', orgId: 'org-a', isArchived: true },
    ])
    .run()
  db.insert(session)
    .values({
      id: 'session-1',
      token: 'token-1',
      userId: 'partner',
      expiresAt: new Date('2099-01-01'),
    })
    .run()
})

afterAll(() => db.$client.close())

const json = (body: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

describe('POST /api/users', () => {
  it('rejects a non-admin', async () => {
    const response = await call(createUser, '/api/users', identity('partner'), json({
      name: 'New',
      email: 'new@example.com',
      orgId: 'org-a',
    }))

    expect(response.status).toBe(403)
  })

  it('returns 400 for a bodyless request instead of crashing', async () => {
    const response = await call(createUser, '/api/users', identity('admin'), {
      method: 'POST',
    })

    expect(response.status).toBe(400)
  })

  it('rejects a malformed email', async () => {
    const response = await call(createUser, '/api/users', identity('admin'), json({
      name: 'New',
      email: 'not-an-email',
      orgId: 'org-a',
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ statusMessage: 'Invalid email' })
  })
})

describe('PATCH /api/users/:id', () => {
  it('rejects changing your own role', async () => {
    const response = await call(patchUser, '/api/users/admin', identity('admin'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-a' }),
    })

    expect(response.status).toBe(400)
  })

  it('rejects changing an administrator target', async () => {
    const response = await call(patchUser, '/api/users/other-admin', identity('admin'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-a' }),
    })

    expect(response.status).toBe(403)
  })

  it('rejects promoting a partner to administrator', async () => {
    const response = await call(patchUser, '/api/users/partner', identity('admin'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId: null }),
    })

    expect(response.status).toBe(403)
  })

  it('moves a partner to another organization', async () => {
    const response = await call(patchUser, '/api/users/partner', identity('admin'), {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orgId: 'org-b' }),
    })

    expect(response.status).toBe(200)
    expect(db.select().from(user).where(eq(user.id, 'partner')).get()?.orgId).toBe('org-b')
  })
})

describe('DELETE /api/users/:id', () => {
  it('rejects archiving your own account', async () => {
    const response = await call(deleteUser, '/api/users/admin', identity('admin'), {
      method: 'DELETE',
    })

    expect(response.status).toBe(400)
  })

  it('rejects archiving another administrator', async () => {
    const response = await call(deleteUser, '/api/users/other-admin', identity('admin'), {
      method: 'DELETE',
    })

    expect(response.status).toBe(403)
  })

  it('archives a partner and revokes their sessions', async () => {
    const response = await call(deleteUser, '/api/users/partner', identity('admin'), {
      method: 'DELETE',
    })

    expect(response.status).toBe(200)
    expect(db.select().from(user).where(eq(user.id, 'partner')).get()?.isArchived).toBe(true)
    expect(db.select().from(session).where(eq(session.userId, 'partner')).all()).toHaveLength(0)
  })
})
