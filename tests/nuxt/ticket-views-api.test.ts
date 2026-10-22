// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createRouter, defineEventHandler, toWebHandler, type H3EventContext } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import { organization, project, tickets, user } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import listHandler from '../../server/api/tickets/index.get'
import detailHandler from '../../server/api/tickets/[id].get'
import editHandler from '../../server/api/tickets/[id].patch'

vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  return { db: drizzle(new Database(':memory:'), { schema }) }
})
migrate(db, { migrationsFolder: './drizzle' })
db.$client.pragma('foreign_keys = ON')
afterAll(() => db.$client.close())

function request(path = '', identity: string | null = 'a', body?: unknown) {
  const app = createApp()
  app.use(
    defineEventHandler((event) => {
      event.context.user =
        identity === null ? undefined : ({ id: identity } as H3EventContext['user'])
    })
  )
  const router = createRouter()
  router.get('/api/tickets', listHandler)
  router.get('/api/tickets/:id', detailHandler)
  router.patch('/api/tickets/:id', editHandler)
  app.use(router)
  return toWebHandler(app)(
    new Request(`http://localhost/api/tickets${path}`, {
      method: body === undefined ? 'GET' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  )
}
const edit = { title: '  Revised title  ', description: '  Revised description  ' }

beforeEach(() => {
  db.delete(tickets).run()
  db.delete(project).run()
  db.delete(user).run()
  db.delete(organization).run()
  db.insert(organization)
    .values([
      { id: 'org-a', name: 'A' },
      { id: 'org-b', name: 'B' },
      { id: 'empty', name: 'Empty' },
    ])
    .run()
  db.insert(user)
    .values([
      { id: 'a', name: 'Alice', email: 'a@example.com', orgId: 'org-a' },
      { id: 'colleague', name: 'Colleague', email: 'c@example.com', orgId: 'org-a' },
      { id: 'b', name: 'Bob', email: 'b@example.com', orgId: 'org-b' },
      { id: 'npts', name: 'NPTS', email: 'n@example.com', orgId: null },
      { id: 'empty', name: 'Empty', email: 'e@example.com', orgId: 'empty' },
    ])
    .run()
  db.insert(project)
    .values([
      { id: 1, name: 'Website A', githubRepo: 'example/a', projectPartnerId: 'org-a' },
      { id: 2, name: 'Website B', githubRepo: 'example/b', projectPartnerId: 'org-b' },
      { id: 3, name: 'Portal A', githubRepo: 'example/c', projectPartnerId: 'org-a' },
    ])
    .run()
  db.insert(tickets)
    .values([
      {
        id: 1,
        projectId: 1,
        userId: 'a',
        title: 'Own ticket',
        description: 'Details A',
        status: 'open',
        timestamp: '2026-10-01T12:00:00.000Z',
      },
      {
        id: 2,
        projectId: 2,
        userId: 'b',
        title: 'Private B',
        description: 'Private details',
        status: 'open',
        timestamp: '2026-10-03T12:00:00.000Z',
      },
      {
        id: 3,
        projectId: 3,
        userId: 'colleague',
        title: 'Colleague ticket',
        description: 'Details C',
        status: 'in_progress',
        timestamp: '2026-10-02T12:00:00.000Z',
      },
      {
        id: 4,
        projectId: 1,
        userId: null,
        title: 'Deleted author',
        description: 'Retained',
        status: 'closed',
        timestamp: '2026-10-02T12:00:00.000Z',
      },
    ])
    .run()
})

describe('shared ticket reads', () => {
  it('returns every ticket in the partner organization, newest first with stable ties', async () => {
    const response = await request()
    expect(response.status).toBe(200)
    const rows = await response.json()
    expect(rows.map((row: { id: number }) => row.id)).toEqual([4, 3, 1])
    expect(rows[2]).toEqual({
      id: 1,
      title: 'Own ticket',
      projectId: 1,
      projectName: 'Website A',
      status: 'open',
      timestamp: '2026-10-01T12:00:00.000Z',
    })
  })
  it('returns all organizations for NPTS', async () => {
    expect((await (await request('', 'npts')).json()).map((row: { id: number }) => row.id)).toEqual(
      [2, 4, 3, 1]
    )
    expect((await (await request('/2', 'npts')).json()).title).toBe('Private B')
  })
  it('returns an empty list for a partner without projects', async () => {
    expect(await (await request('', 'empty')).json()).toEqual([])
  })
  it('filters by project and status without weakening organization scoping', async () => {
    const rows = await (await request('?projectId=1&status=open')).json()
    expect(rows.map((row: { id: number }) => row.id)).toEqual([1])
    expect(await (await request('?status=unknown')).json()).toEqual([])
  })
  it.each(['?projectId=2', '?projectId=999'])(
    'rejects inaccessible and missing project filters: %s',
    async (query) => {
      expect((await request(query)).status).toBe(404)
    }
  )
  it.each([
    '?projectId=0',
    '?projectId=1.5',
    '?projectId=1&projectId=2',
    '?role=npts',
    '?orgId=org-b',
    '?status=',
  ])('rejects invalid or forged filters: %s', async (query) => {
    expect((await request(query)).status).toBe(400)
  })
  it.each(['/2', '/999', '/1junk', '/0', '/9007199254740993'])(
    'returns the same 404 for inaccessible, missing and invalid IDs: %s',
    async (path) => {
      const response = await request(path)
      expect(response.status).toBe(404)
      expect(await response.json()).toMatchObject({ statusMessage: 'Ticket not found' })
    }
  )
  it('returns content, author and edit permission without sensitive user fields', async () => {
    expect(await (await request('/1')).json()).toEqual({
      id: 1,
      title: 'Own ticket',
      description: 'Details A',
      projectId: 1,
      projectName: 'Website A',
      status: 'open',
      timestamp: '2026-10-01T12:00:00.000Z',
      userId: 'a',
      submitterName: 'Alice',
      githubIssueId: null,
      githubIssueUrl: null,
      canEdit: true,
    })
    expect(await (await request('/4')).json()).toMatchObject({
      userId: null,
      submitterName: null,
      canEdit: false,
    })
  })
  it('links a stored GitHub issue number and never renders arbitrary URLs', async () => {
    db.update(tickets).set({ githubIssueId: '42' }).where(eq(tickets.id, 1)).run()
    expect(await (await request('/1')).json()).toMatchObject({
      githubIssueUrl: 'https://github.com/example/a/issues/42',
    })
    db.update(tickets).set({ githubIssueId: 'javascript:alert(1)' }).where(eq(tickets.id, 1)).run()
    expect(await (await request('/1')).json()).toMatchObject({ githubIssueUrl: null })
  })
  it('reads a changed status on the next list and detail request', async () => {
    await request('/1')
    db.update(tickets).set({ status: 'resolved' }).where(eq(tickets.id, 1)).run()
    expect(await (await request('/1')).json()).toMatchObject({ status: 'resolved', canEdit: false })
    expect(
      (await (await request()).json()).find((row: { id: number }) => row.id === 1).status
    ).toBe('resolved')
  })
  it('uses current membership when an NPTS account becomes a partner', async () => {
    db.update(user).set({ orgId: 'org-b' }).where(eq(user.id, 'npts')).run()
    expect((await (await request('', 'npts')).json()).map((row: { id: number }) => row.id)).toEqual(
      [2]
    )
    expect((await request('/1', 'npts')).status).toBe(404)
  })
  it.each(['', '/1'])('rejects signed-out and deleted accounts for %s', async (path) => {
    expect((await request(path, null)).status).toBe(401)
    db.delete(user).where(eq(user.id, 'npts')).run()
    expect((await request(path, 'npts')).status).toBe(403)
  })
})

describe('ticket content updates', () => {
  it('saves trimmed content and preserves server-owned fields', async () => {
    const before = db.select().from(tickets).where(eq(tickets.id, 1)).get()
    const response = await request('/1', 'a', edit)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      title: 'Revised title',
      description: 'Revised description',
    })
    expect(db.select().from(tickets).where(eq(tickets.id, 1)).get()).toEqual({
      ...before,
      title: 'Revised title',
      description: 'Revised description',
    })
  })
  it.each(['colleague', 'npts'])('rejects other authors including %s', async (identity) => {
    expect((await request('/1', identity, edit)).status).toBe(403)
    expect(db.select().from(tickets).where(eq(tickets.id, 1)).get()?.title).toBe('Own ticket')
  })
  it.each(['closed', 'in_progress', 'resolved'])(
    'rejects author edits after status becomes %s',
    async (status) => {
      db.update(tickets).set({ status }).where(eq(tickets.id, 1)).run()
      expect((await request('/1', 'a', edit)).status).toBe(403)
    }
  )
  it('rejects inaccessible/missing tickets, signed-out users and deleted accounts', async () => {
    expect((await request('/2', 'a', edit)).status).toBe(404)
    expect((await request('/999', 'a', edit)).status).toBe(404)
    expect((await request('/1', null, edit)).status).toBe(401)
    expect((await request('/1', 'deleted', edit)).status).toBe(403)
  })
  it.each(['status', 'userId', 'projectId', 'timestamp', 'githubIssueId', 'orgId'])(
    'rejects forbidden field %s',
    async (field) => {
      expect((await request('/1', 'a', { ...edit, [field]: 'forged' })).status).toBe(400)
    }
  )
  it.each([{}, { title: ' ', description: 'x' }, { title: 'x', description: '' }, null])(
    'rejects invalid content: %j',
    async (body) => {
      expect((await request('/1', 'a', body)).status).toBe(400)
    }
  )
})
