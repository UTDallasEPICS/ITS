import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { project, tickets, user } from '../../db/schema'
import { db } from '../../utils/db'
import { requireUser } from '../../utils/session'

// Accept only form fields. Identity, status, timestamps and GitHub links are
// server-owned and must not be supplied by the caller.
const createTicketSchema = z.strictObject({
  projectId: z.number().int().positive(),
  title: z.string().trim().min(1, 'Enter a ticket title.'),
  description: z.string().trim().min(1, 'Describe the issue.'),
})

export default defineEventHandler(async (event) => {
  const sessionUser = requireUser(event)
  const result = createTicketSchema.safeParse(await readBody(event))

  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid ticket data' })
  }

  // Keep the current membership check, project check and insert together so
  // access cannot change between checking ownership and writing the ticket.
  const ticket = db.transaction((tx) => {
    const currentUser = tx
      .select({ orgId: user.orgId })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .get()

    if (!currentUser) {
      throw createError({ statusCode: 403, statusMessage: 'Account access unavailable' })
    }

    const accessibleProject = tx
      .select({ id: project.id })
      .from(project)
      .where(
        and(
          eq(project.id, result.data.projectId),
          // NPTS can submit for any project; partners remain organization-scoped.
          currentUser.orgId === null ? undefined : eq(project.projectPartnerId, currentUser.orgId)
        )
      )
      .get()

    // Use the same response for missing and inaccessible projects.
    if (!accessibleProject) {
      throw createError({ statusCode: 404, statusMessage: 'Project not found' })
    }

    const created = tx
      .insert(tickets)
      .values({
        ...result.data,
        userId: sessionUser.id,
        status: 'open',
        timestamp: new Date().toISOString(),
      })
      .returning()
      .get()

    if (!created) {
      throw createError({ statusCode: 500, statusMessage: 'Unable to create ticket' })
    }

    return created
  })

  setResponseStatus(event, 201)
  return ticket
})
