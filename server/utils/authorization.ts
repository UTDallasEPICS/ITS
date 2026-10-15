import { eq } from 'drizzle-orm'
import { db } from './db'
import { user, project } from '../db/schema'

// orgId is null for admin users
function isAdmin(orgId: string | null) {
  return orgId === null
}

async function getUserOrgId(userId: string) {
  const [foundUser] = await db.select({ orgId: user.orgId }).from(user).where(eq(user.id, userId))
  if (!foundUser) {
    throw createError({
      statusCode: 403,
      statusMessage: 'User does not have project access',
    })
  }

  return foundUser.orgId
}

export async function requireAdmin(userId: string) {
  const orgId = await getUserOrgId(userId)
  if (!isAdmin(orgId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }
}

export async function requireProjectAccess(userId: string, projectId: number) {
  const orgId = await getUserOrgId(userId)

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
  if (isAdmin(orgId)) {
    return
  }
  if (orgId !== foundProject.projectPartnerId) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
    })
  }
}
