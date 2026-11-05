// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { organization, project, tickets } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import { resetRateLimits } from '../../server/utils/rateLimit'
import widgetTicketsHandler from '../../server/api/widget/tickets.post'

// Use an in-memory database, same as the partner ticket API tests.
vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  return { db: drizzle(new Database(':memory:'), { schema }) }
})

migrate(db, { migrationsFolder: './drizzle' })
db.$client.pragma('foreign_keys = ON')

const validTicket = {
  siteTag: 'site-a',
  title: '  Registration form is broken  ',
  description: '  Nothing happens when I click Submit.  ',
}

// No session middleware here: the widget endpoint must work for anonymous users.
function requestRaw(body: string, headers: Record<string, string> = {}) {
  const app = createApp()
  app.use('/api/widget/tickets', widgetTicketsHandler)
  return toWebHandler(app)(
    new Request('http://localhost/api/widget/tickets', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    })
  )
}

function request(body: unknown = validTicket, headers: Record<string, string> = {}) {
  return requestRaw(JSON.stringify(body), headers)
}

function expectNoTickets() {
  expect(db.select().from(tickets).all()).toEqual([])
}

describe('POST /api/widget/tickets', () => {
  beforeEach(() => {
    resetRateLimits()
    db.delete(tickets).run()
    db.delete(project).run()
    db.delete(organization).run()
    db.insert(organization).values({ id: 'org-a', name: 'Partner A' }).run()
    db.insert(project)
      .values([
        {
          id: 1,
          name: 'Website A',
          githubRepo: 'example/a',
          projectPartnerId: 'org-a',
          siteTag: 'site-a',
        },
        // A project that hasn't set up the widget.
        { id: 2, name: 'Website B', githubRepo: 'example/b', projectPartnerId: 'org-a' },
      ])
      .run()
  })

  afterAll(() => {
    db.$client.close()
  })

  it('saves an anonymous ticket under the site tag project and returns only the id', async () => {
    const response = await request()
    expect(response.status).toBe(201)

    const body = await response.json()
    // Only the id goes back to the public widget.
    expect(body).toEqual({ id: expect.any(Number) })

    expect(db.select().from(tickets).all()).toEqual([
      {
        id: body.id,
        projectId: 1,
        title: 'Registration form is broken',
        description: 'Nothing happens when I click Submit.',
        userId: null,
        status: 'open',
        timestamp: expect.any(String),
        githubIssueId: null,
      },
    ])
  })

  it('rejects an unknown site tag with a generic 404', async () => {
    const response = await request({ ...validTicket, siteTag: 'unknown-site' })
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ statusMessage: 'Not found' })
    expectNoTickets()
  })

  it.each([
    ['empty object', {}],
    ['null body', null],
    ['array body', [validTicket]],
    ['missing site tag', { title: 'Issue', description: 'Details' }],
    ['blank site tag', { ...validTicket, siteTag: '  ' }],
    ['missing title', { siteTag: 'site-a', description: 'Details' }],
    ['blank title', { ...validTicket, title: ' \n ' }],
    ['too long title', { ...validTicket, title: 'a'.repeat(201) }],
    ['missing description', { siteTag: 'site-a', title: 'Issue' }],
    ['too long description', { ...validTicket, description: 'a'.repeat(5001) }],
  ])('rejects invalid input: %s', async (_name, body) => {
    const response = await request(body)
    expect(response.status).toBe(400)
    expectNoTickets()
  })

  it.each(['projectId', 'userId', 'status', 'timestamp', 'githubIssueId'])(
    'rejects a caller-supplied %s field',
    async (field) => {
      const response = await request({ ...validTicket, [field]: 'forged' })
      expect(response.status).toBe(400)
      expectNoTickets()
    }
  )

  it('rejects malformed JSON without writing a ticket', async () => {
    const response = await requestRaw('{"siteTag":')
    expect(response.status).toBe(400)
    expectNoTickets()
  })

  it('blocks a client after 3 submissions in a short time with 429 and Retry-After', async () => {
    for (let i = 0; i < 3; i++) {
      expect((await request()).status).toBe(201)
    }

    const blocked = await request()
    expect(blocked.status).toBe(429)
    expect(blocked.headers.get('retry-after')).toBe('300')
    expect(db.select().from(tickets).all()).toHaveLength(3)
  })

  it('counts different clients separately', async () => {
    const clientA = { 'x-forwarded-for': '1.1.1.1' }
    const clientB = { 'x-forwarded-for': '2.2.2.2' }

    for (let i = 0; i < 3; i++) await request(validTicket, clientA)
    expect((await request(validTicket, clientA)).status).toBe(429)
    expect((await request(validTicket, clientB)).status).toBe(201)
  })

  it('uses the last X-Forwarded-For entry, so fake earlier entries do not bypass the limit', async () => {
    for (let i = 0; i < 3; i++) {
      await request(validTicket, { 'x-forwarded-for': `10.0.0.${i}, 9.9.9.9` })
    }
    const blocked = await request(validTicket, { 'x-forwarded-for': '10.0.0.99, 9.9.9.9' })
    expect(blocked.status).toBe(429)
  })
})
