import { requireUser } from '../../utils/session'
import { requireAdmin } from '../../utils/authorization'
import { db } from '../../utils/db'
import { validateOrganization } from '../../utils/user-validation'
import { user } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // guard
  const currentUser = requireUser(event)
  await requireAdmin(currentUser.id)

  const targetUserId = getRouterParam(event, 'id')

  if (!targetUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'User ID is required',
    })
  }

  const body = await readBody(event)
  const { orgId } = body
  // Validate the organization ID
  const validatedOrgId = await validateOrganization(orgId)
  // Update the user's organization ID
  const [updatedUser] = await db
    .update(user)
    .set({
      orgId: validatedOrgId,
      updatedAt: new Date(),
    })
    .where(eq(user.id, targetUserId))
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      orgId: user.orgId,
    })

  if (!updatedUser) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    })
  }

  return {
    message: 'User role updated successfully',
    user: updatedUser,
  }
})
