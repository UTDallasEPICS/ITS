// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineEventHandler, toWebHandler, type H3EventContext } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { organization, user } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import organizationsHandler from '../../server/api/organizations/index.get'

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

function request(as: Identity | null) {
  const app = createApp()
  app.use(
    defineEventHandler((event) => {
      event.context.user = as ?? undefined
    }),
  )
  app.use('/api/organizations', organizationsHandler)
  return toWebHandler(app)(new Request('http://localhost/api/organizations'))
}

beforeEach(() => {
  db.delete(user).run()
  db.delete(organization).run()
  db.insert(organization)
    .values([
      { id: 'org-b', name: 'Beta' },
      { id: 'org-a', name: 'Alpha' },
    ])
    .run()
  db.insert(user)
    .values([
      { id: 'admin', name: 'Admin', email: 'admin@example.com', orgId: null },
      { id: 'partner', name: 'Partner', email: 'partner@example.com', orgId: 'org-a' },
    ])
    .run()
})

afterAll(() => db.$client.close())

describe('GET /api/organizations', () => {
  it('returns organizations alphabetically for an admin', async () => {
    const response = await request(identity('admin'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([
      { id: 'org-a', name: 'Alpha' },
      { id: 'org-b', name: 'Beta' },
    ])
  })

  it('rejects a partner', async () => {
    const response = await request(identity('partner'))

    expect(response.status).toBe(403)
  })

  it('rejects an unauthenticated request', async () => {
    const response = await request(null)

    expect(response.status).toBe(401)
  })
})
