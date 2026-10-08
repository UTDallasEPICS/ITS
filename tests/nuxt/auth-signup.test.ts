// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, createError, defineEventHandler, toWebHandler } from 'h3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import {
  account,
  organization,
  project,
  session,
  tickets,
  user,
  verification,
} from '../../server/db/schema'
import { db } from '../../server/utils/db'
import { auth } from '../../server/utils/auth'
import projectsHandler from '../../server/api/projects/index.get'
import ticketsHandler from '../../server/api/tickets/index.post'

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }))

vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  return { db: drizzle(new Database(':memory:'), { schema }) }
})

// Import the real auth configuration, but never load .env or connect to SMTP.
vi.mock('../../server/utils/env', () => ({
  env: {
    DATABASE_URL: ':memory:',
    BETTER_AUTH_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'test-only-auth-secret-7f28d104c68a459bb3e2',
    EMAIL_HOST: 'smtp.example.com',
    EMAIL_USER: 'sender@example.com',
    EMAIL_PASS: 'test-only-mail-password',
    EMAIL_FROM: 'sender@example.com',
  },
}))

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}))

migrate(db, { migrationsFolder: './drizzle' })
db.$client.pragma('foreign_keys = ON')

function request(path: string, body: unknown) {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
      body: JSON.stringify(body),
    })
  )
}

let protectedRequest: ReturnType<typeof toWebHandler>

beforeAll(async () => {
  // Supply Nitro's runtime globals, then load the actual middleware. No session
  // identity is injected: Better Auth verifies the login cookie on every request.
  vi.stubGlobal('defineEventHandler', defineEventHandler)
  vi.stubGlobal('createError', createError)
  const { default: authMiddleware } = await import('../../server/middleware/auth')
  const app = createApp()
  app.use(authMiddleware)
  app.use('/api/projects', projectsHandler)
  app.use('/api/tickets', ticketsHandler)
  protectedRequest = toWebHandler(app)
})

async function login(email: string) {
  const previousMessages = sendMail.mock.calls.length
  const sent = await request('/email-otp/send-verification-otp', { email, type: 'sign-in' })
  expect(sent.status).toBe(200)
  await vi.waitFor(() => expect(sendMail).toHaveBeenCalledTimes(previousMessages + 1))
  const mail = sendMail.mock.calls.at(-1)![0] as { to: string; html: string }
  expect(mail.to).toBe(email)
  const otp = mail.html.match(/\b\d{6}\b/)?.[0]
  expect(otp).toBeDefined()
  const signedIn = await request('/sign-in/email-otp', { email, otp })
  expect(signedIn.status).toBe(200)
  const cookie = signedIn.headers
    .getSetCookie()
    .map((header) => header.split(';')[0])
    .join('; ')
  expect(cookie.length).toBeGreaterThan(0)
  return cookie
}

function listProjects(cookie = '', query = '') {
  return protectedRequest(
    new Request(`http://localhost:3000/api/projects${query}`, {
      headers: { cookie },
    })
  )
}

function createTicket(projectId: number, cookie = '') {
  return protectedRequest(
    new Request('http://localhost:3000/api/tickets', {
      method: 'POST',
      headers: { cookie, 'content-type': 'application/json' },
      body: JSON.stringify({
        projectId,
        title: 'Access test',
        description: 'Fictional test ticket.',
      }),
    })
  )
}

describe('provisioned-user OTP login', () => {
  beforeEach(() => {
    sendMail.mockReset().mockResolvedValue({ messageId: 'test-message' })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'))
    db.delete(tickets).run()
    db.delete(project).run()
    db.delete(session).run()
    db.delete(verification).run()
    db.delete(account).run()
    db.delete(user).run()
    db.delete(organization).run()
    db.insert(organization)
      .values([
        { id: 'org-a', name: 'Test Partner A' },
        { id: 'org-b', name: 'Test Partner B' },
      ])
      .run()
    db.insert(user)
      .values([
        { id: 'npts', name: 'NPTS Member', email: 'npts@example.com', orgId: null },
        { id: 'partner', name: 'Partner', email: 'partner@example.com', orgId: 'org-a' },
      ])
      .run()
    db.insert(project)
      .values([
        { id: 1, name: 'Project A', githubRepo: 'example/a', projectPartnerId: 'org-a' },
        { id: 2, name: 'Project B', githubRepo: 'example/b', projectPartnerId: 'org-b' },
      ])
      .run()
  })

  afterEach(() => {
    expect(globalThis.fetch).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  afterAll(() => {
    db.$client.close()
    vi.unstubAllGlobals()
  })

  it('defaults a newly provisioned account to NPTS when orgId is omitted from the database insert', async () => {
    // Omit the column in SQL itself to verify SQLite's default, not just an ORM value.
    const now = Math.floor(Date.now() / 1000)
    db.$client
      .prepare('INSERT INTO user (id, name, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)')
      .run('new-npts', 'New NPTS Member', 'new-npts@example.com', now, now)
    expect(db.select().from(user).where(eq(user.id, 'new-npts')).get()?.orgId).toBeNull()

    const cookie = await login('new-npts@example.com')
    const projects = await listProjects(cookie)
    expect(projects.status).toBe(200)
    expect(await projects.json()).toEqual([
      { id: 1, name: 'Project A' },
      { id: 2, name: 'Project B' },
    ])
    expect((await createTicket(1, cookie)).status).toBe(201)
    expect((await createTicket(2, cookie)).status).toBe(201)
    expect(db.select({ userId: tickets.userId }).from(tickets).all()).toEqual([
      { userId: 'new-npts' },
      { userId: 'new-npts' },
    ])
  })

  it('does not send a sign-in code or create an account for an unknown email', async () => {
    const response = await request('/email-otp/send-verification-otp', {
      email: 'unknown@example.com',
      type: 'sign-in',
    })
    // Keep the generic response so the endpoint does not reveal account existence.
    expect(response.status).toBe(200)
    expect(sendMail).not.toHaveBeenCalled()
    expect(
      db.select().from(user).where(eq(user.email, 'unknown@example.com')).get()
    ).toBeUndefined()
    expect(db.select().from(verification).all()).toEqual([])
    expect(db.select().from(session).all()).toEqual([])
  })

  it('refuses signup even when an unknown email has a valid previously issued OTP', async () => {
    // Use the server-only API to model a code issued before signup was disabled.
    const otp = await auth.api.createVerificationOTP({
      body: { email: 'unknown@example.com', type: 'sign-in' },
    })
    const response = await request('/sign-in/email-otp', { email: 'unknown@example.com', otp })
    expect(response.status).toBe(400)
    expect(
      db.select().from(user).where(eq(user.email, 'unknown@example.com')).get()
    ).toBeUndefined()
    expect(db.select().from(session).all()).toEqual([])
  })

  it.each([
    { id: 'npts', email: 'npts@example.com', orgId: null },
    { id: 'partner', email: 'partner@example.com', orgId: 'org-a' },
  ])('still signs in the provisioned $id account without changing its access', async (identity) => {
    const sent = await request('/email-otp/send-verification-otp', {
      email: identity.email,
      type: 'sign-in',
    })
    expect(sent.status).toBe(200)
    await vi.waitFor(() => expect(sendMail).toHaveBeenCalledOnce())
    const mail = sendMail.mock.calls[0]![0] as { to: string; html: string }
    expect(mail.to).toBe(identity.email)
    const otp = mail.html.match(/\b\d{6}\b/)?.[0]
    expect(otp).toBeDefined()

    const signedIn = await request('/sign-in/email-otp', { email: identity.email, otp })
    expect(signedIn.status).toBe(200)
    expect((await signedIn.json()).user.id).toBe(identity.id)
    expect(db.select().from(session).get()?.userId).toBe(identity.id)
    expect(db.select().from(user).where(eq(user.id, identity.id)).get()?.orgId).toBe(identity.orgId)
  })

  it('lets a logged-in NPTS user list and submit to both organizations through real middleware', async () => {
    const cookie = await login('npts@example.com')
    const projects = await listProjects(cookie)
    expect(projects.status).toBe(200)
    expect(await projects.json()).toEqual([
      { id: 1, name: 'Project A' },
      { id: 2, name: 'Project B' },
    ])

    expect((await createTicket(1, cookie)).status).toBe(201)
    expect((await createTicket(2, cookie)).status).toBe(201)
    expect(
      db.select({ projectId: tickets.projectId, userId: tickets.userId }).from(tickets).all()
    ).toEqual([
      { projectId: 1, userId: 'npts' },
      { projectId: 2, userId: 'npts' },
    ])
  })

  it('limits a logged-in partner to their organization even when they forge request parameters', async () => {
    const cookie = await login('partner@example.com')
    const projects = await listProjects(cookie, '?userId=npts&orgId=org-b')
    expect(projects.status).toBe(200)
    expect(await projects.json()).toEqual([{ id: 1, name: 'Project A' }])

    expect((await createTicket(1, cookie)).status).toBe(201)
    expect((await createTicket(2, cookie)).status).toBe(404)
    expect(
      db.select({ projectId: tickets.projectId, userId: tickets.userId }).from(tickets).all()
    ).toEqual([{ projectId: 1, userId: 'partner' }])
  })

  it.each(['', 'better-auth.session_token=invalid-session'])(
    'blocks protected routes without a valid cookie (%s)',
    async (cookie) => {
      expect((await listProjects(cookie)).status).toBe(401)
      expect((await createTicket(1, cookie)).status).toBe(401)
      expect(db.select().from(tickets).all()).toEqual([])
    }
  )

  it('blocks a previously signed-in NPTS user after the session is revoked', async () => {
    const cookie = await login('npts@example.com')
    db.delete(session).where(eq(session.userId, 'npts')).run()
    expect((await listProjects(cookie)).status).toBe(401)
    expect((await createTicket(1, cookie)).status).toBe(401)
    expect(db.select().from(tickets).all()).toEqual([])
  })

  it('applies a new partner assignment to an existing NPTS session immediately', async () => {
    const cookie = await login('npts@example.com')
    db.update(user).set({ orgId: 'org-a' }).where(eq(user.id, 'npts')).run()
    const projects = await listProjects(cookie)
    expect(projects.status).toBe(200)
    expect(await projects.json()).toEqual([{ id: 1, name: 'Project A' }])
    expect((await createTicket(2, cookie)).status).toBe(404)
    expect((await createTicket(1, cookie)).status).toBe(201)
  })
})
