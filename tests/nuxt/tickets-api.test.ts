// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineEventHandler, toWebHandler, type H3EventContext } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import { organization, project, tickets, user } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import ticketsHandler from '../../server/api/tickets/index.post'

// No local database, environment configuration, email or GitHub calls.
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
  email: 'a@example.com',
  emailVerified: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

const validTicket = {
  projectId: 1,
  title: '  Contact form is broken  ',
  description: '  Clicking Send does nothing.  ',
}

function requestRaw(body: string, identity: H3EventContext['user'] | null = sessionUser) {
  const app = createApp()
  app.use(
    defineEventHandler((event) => {
      event.context.user = identity ?? undefined
    })
  )
  app.use('/api/tickets', ticketsHandler)
  return toWebHandler(app)(
    new Request('http://localhost/api/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
  )
}

function request(
  body: unknown = validTicket,
  identity: H3EventContext['user'] | null = sessionUser
) {
  return requestRaw(JSON.stringify(body), identity)
}

function expectNoTickets() {
  expect(db.select().from(tickets).all()).toEqual([])
}

describe('POST /api/tickets', () => {
  beforeEach(() => {
    db.delete(tickets).run()
    db.delete(project).run()
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
        { id: 'partner-a', name: 'Partner A', email: 'a@example.com', orgId: 'org-a' },
        { id: 'partner-b', name: 'Partner B', email: 'b@example.com', orgId: 'org-b' },
        { id: 'unassigned', name: 'Unassigned', email: 'none@example.com' },
      ])
      .run()
    db.insert(project)
      .values([
        { id: 1, name: 'Website A', githubRepo: 'example/a', projectPartnerId: 'org-a' },
        { id: 2, name: 'Website B', githubRepo: 'example/b', projectPartnerId: 'org-b' },
      ])
      .run()
  })

  afterAll(() => {
    db.$client.close()
  })

  it('saves a trimmed ticket with server-owned fields and responds with 201', async () => {
    const beforeRequest = Date.now()
    const response = await request()
    expect(response.status).toBe(201)
    const created = await response.json()
    expect(created).toEqual({
      id: expect.any(Number),
      projectId: 1,
      title: 'Contact form is broken',
      description: 'Clicking Send does nothing.',
      userId: 'partner-a',
      status: 'open',
      timestamp: expect.any(String),
      githubIssueId: null,
    })
    expect(Date.parse(created.timestamp)).toBeGreaterThanOrEqual(beforeRequest)
    expect(Date.parse(created.timestamp)).toBeLessThanOrEqual(Date.now())
    expect(new Date(created.timestamp).toISOString()).toBe(created.timestamp)
    expect(db.select().from(tickets).all()).toEqual([created])
  })

  it('uses the signed-in author when another partner submits to their own project', async () => {
    const response = await request(
      { ...validTicket, projectId: 2 },
      { ...sessionUser, id: 'partner-b' }
    )
    expect(response.status).toBe(201)
    expect(db.select().from(tickets).get()).toMatchObject({ projectId: 2, userId: 'partner-b' })
  })

  it('rejects signed-out requests without inserting a ticket', async () => {
    const response = await request(validTicket, null)
    expect(response.status).toBe(401)
    expectNoTickets()
  })

  it('rejects users without a partner organization', async () => {
    const response = await request(validTicket, { ...sessionUser, id: 'unassigned' })
    expect(response.status).toBe(403)
    expectNoTickets()
  })

  it('rejects a session identity whose user has been deleted', async () => {
    db.delete(user).where(eq(user.id, sessionUser.id)).run()
    const response = await request()
    expect(response.status).toBe(403)
    expectNoTickets()
  })

  it.each([2, 999])(
    'rejects inaccessible or missing project %i with the same 404',
    async (projectId) => {
      const response = await request({ ...validTicket, projectId })
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ statusMessage: 'Project not found' })
      expectNoTickets()
    }
  )

  it('uses current organization membership instead of stale session assumptions', async () => {
    db.update(user).set({ orgId: 'org-b' }).where(eq(user.id, sessionUser.id)).run()
    const rejected = await request()
    expect(rejected.status).toBe(404)
    expectNoTickets()

    const accepted = await request({ ...validTicket, projectId: 2 })
    expect(accepted.status).toBe(201)
    expect(db.select().from(tickets).get()).toMatchObject({ projectId: 2, userId: 'partner-a' })
  })

  it.each([
    ['empty object', {}],
    ['null body', null],
    ['array body', [validTicket]],
    ['missing project', { title: 'Issue', description: 'Details' }],
    ['string project ID', { ...validTicket, projectId: '1' }],
    ['zero project ID', { ...validTicket, projectId: 0 }],
    ['negative project ID', { ...validTicket, projectId: -1 }],
    ['fractional project ID', { ...validTicket, projectId: 1.5 }],
    ['missing title', { projectId: 1, description: 'Details' }],
    ['blank title', { ...validTicket, title: ' \n ' }],
    ['non-text title', { ...validTicket, title: 42 }],
    ['missing description', { projectId: 1, title: 'Issue' }],
    ['blank description', { ...validTicket, description: ' \n ' }],
    ['non-text description', { ...validTicket, description: { text: 'Details' } }],
  ])('rejects invalid input: %s', async (_name, body) => {
    const response = await request(body)
    expect(response.status).toBe(400)
    expectNoTickets()
  })

  it.each(['id', 'userId', 'status', 'timestamp', 'githubIssueId', 'orgId', 'projectPartnerId'])(
    'rejects a caller-supplied %s field',
    async (field) => {
      const response = await request({ ...validTicket, [field]: 'forged' })
      expect(response.status).toBe(400)
      expectNoTickets()
    }
  )

  it('rejects malformed JSON without writing a ticket', async () => {
    const response = await requestRaw('{"projectId":')
    expect(response.status).toBe(400)
    expectNoTickets()
  })
})
