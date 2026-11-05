import { eq } from 'drizzle-orm'
import {
  createError,
  defineEventHandler,
  getRequestHeader,
  getRequestIP,
  readBody,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { z } from 'zod'
import { project, tickets } from '../../db/schema'
import { db } from '../../utils/db'
import { checkRateLimit } from '../../utils/rateLimit'

// Accept only the fields the widget form sends. Project, status, author and
// timestamps are decided by the server, not the caller.
const widgetTicketSchema = z.strictObject({
  siteTag: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1, 'Enter a ticket title.').max(200),
  description: z.string().trim().min(1, 'Describe the issue.').max(5000),
})

// Limits from ADR 006. Starting values; tune with real traffic.
const PER_CLIENT = { max: 3, windowMs: 10_000, cooldownMs: 5 * 60_000 }
const PER_SITE = { max: 50, windowMs: 60 * 60_000, cooldownMs: 0 }

// Public endpoint: lets the embeddable widget submit a ticket without a session.
export default defineEventHandler(async (event) => {
  const result = widgetTicketSchema.safeParse(await readBody(event))

  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid ticket data' })
  }

  const { siteTag } = result.data

  // Real client IP. Behind a load balancer, the last X-Forwarded-For entry is
  // the one our proxy added; earlier entries can be faked by the client.
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  const ip = forwarded?.split(',').at(-1)?.trim() || getRequestIP(event) || 'unknown'

  // Check rate limits before touching the database.
  const perClient = checkRateLimit(`client:${siteTag}:${ip}`, PER_CLIENT)
  const perSite = perClient.ok ? checkRateLimit(`site:${siteTag}`, PER_SITE) : perClient
  const limited = !perClient.ok ? perClient : !perSite.ok ? perSite : null

  if (limited) {
    setResponseHeader(event, 'Retry-After', limited.retryAfter)
    throw createError({ statusCode: 429, statusMessage: 'Too Many Requests' })
  }

  // Find the project this widget belongs to.
  const targetProject = db
    .select({ id: project.id })
    .from(project)
    .where(eq(project.siteTag, siteTag))
    .get()

  // Generic response: don't reveal which site tags exist.
  if (!targetProject) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const created = db
    .insert(tickets)
    .values({
      projectId: targetProject.id,
      title: result.data.title,
      description: result.data.description,
      // Widget users have no ITS account, so there is no author.
      userId: null,
      status: 'open',
      timestamp: new Date().toISOString(),
    })
    .returning({ id: tickets.id })
    .get()

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Unable to create ticket' })
  }

  // Return only what the widget needs, never other project data.
  setResponseStatus(event, 201)
  return { id: created.id }
})
