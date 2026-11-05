import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
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

  const body = (await readBody(event)) ?? {}
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
    })
  }
  const { orgId } = body as { orgId?: unknown }

  // Validate the organization ID
  const validatedOrgId = await validateOrganization(orgId)
  if (validatedOrgId === null) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Administrator promotion is not supported',
    })
  }

  // Prevent users from changing their own organization and from editing administrators
  if (currentUser.id === targetUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You cannot change your own organization',
    })
  }

  const [targetUser] = await db
    .select({
      id: user.id,
      orgId: user.orgId,
      isArchived: user.isArchived,
    })
    .from(user)
    .where(eq(user.id, targetUserId))

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    })
  }

  if (targetUser.orgId === null) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Administrator accounts cannot be changed',
    })
  }

  if (targetUser.isArchived) {
    throw createError({
      statusCode: 409,
      statusMessage: 'User is archived',
    })
  }

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
    message: 'User organization updated successfully',
    user: updatedUser,
  }
})
