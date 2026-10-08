import { asc, eq } from 'drizzle-orm'
import { createError, defineEventHandler } from 'h3'
import { project, user } from '../../db/schema'
import { db } from '../../utils/db'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const sessionUser = requireUser(event)
  // Read the current assignment from the database, never from request parameters.
  const currentUser = await db.query.user.findFirst({
    where: eq(user.id, sessionUser.id),
    columns: { orgId: true },
  })

  if (!currentUser) {
    throw createError({ statusCode: 403, statusMessage: 'Account access unavailable' })
  }

  return (
    db
      .select({ id: project.id, name: project.name })
      .from(project)
      // Existing users with orgId null are NPTS; partners have an organization.
      .where(
        currentUser.orgId === null ? undefined : eq(project.projectPartnerId, currentUser.orgId)
      )
      .orderBy(asc(project.name), asc(project.id))
  )
})
