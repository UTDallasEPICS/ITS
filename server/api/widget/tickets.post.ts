import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { project, tickets } from '../../db/schema'
import { db } from '../../utils/db'

// Accept only the fields the widget form sends. Project, status, author and
// timestamps are decided by the server, not the caller.
const widgetTicketSchema = z.strictObject({
  siteTag: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1, 'Enter a ticket title.').max(200),
  description: z.string().trim().min(1, 'Describe the issue.').max(5000),
})

// Public endpoint: lets the embeddable widget submit a ticket without a session.
export default defineEventHandler(async (event) => {
  const result = widgetTicketSchema.safeParse(await readBody(event))

  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid ticket data' })
  }

  // Find the project this widget belongs to.
  const targetProject = db
    .select({ id: project.id })
    .from(project)
    .where(eq(project.siteTag, result.data.siteTag))
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
