import { eq } from 'drizzle-orm'
import { db } from './db'
import { user, project } from '../db/schema'

export async function requireProjectAccess(userId: string, projectId: number) {
  const [foundUser] = await db.select({ orgId: user.orgId }).from(user).where(eq(user.id, userId))

  if (!foundUser) {
    throw createError({
      statusCode: 403,
      statusMessage: 'User does not have project access',
    })
  }

  const [foundProject] = await db
    .select({ projectPartnerId: project.projectPartnerId })
    .from(project)
    .where(eq(project.id, projectId))

  if (!foundProject) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Project not found',
    })
  }
  if (foundUser.orgId !== foundProject.projectPartnerId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }
}
