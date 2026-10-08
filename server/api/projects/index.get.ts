import { asc, eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'
import { project, user } from '../../db/schema'
import { db } from '../../utils/db'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const sessionUser = requireUser(event)
  // Read the current assignment from the database, never from request parameters.
  const partner = await db.query.user.findFirst({
    where: eq(user.id, sessionUser.id),
    columns: { orgId: true },
  })

  if (!partner?.orgId) {
    throw createError({ statusCode: 403, statusMessage: 'Partner organization required' })
  }

  return db
    .select({ id: project.id, name: project.name })
    .from(project)
    .where(eq(project.projectPartnerId, partner.orgId))
    .orderBy(asc(project.name), asc(project.id))
})
