import { requireUser } from '../../utils/session'
import { requireAdmin } from '../../utils/authorization'
import { db } from '../../utils/db'
import { user, session } from '../../db/schema'
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
  // Check if the target user exists and is not already archived
  const [targetUser] = await db
    .select({
      id: user.id,
      isArchived: user.isArchived,
    })
    .from(user)
    .where(eq(user.id, targetUserId))
  // Prevent users from archiving their own accounts
  if (currentUser.id === targetUserId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'You cannot archive your own account',
    })
  }

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      statusMessage: 'User not found',
    })
  }

  if (targetUser.isArchived) {
    throw createError({
      statusCode: 409,
      statusMessage: 'User is already archived',
    })
  }

  // Archive the user and delete their sessions in a transaction
  db.transaction((tx) => {
    tx.update(user)
      .set({
        isArchived: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, targetUserId))
      .run()

    tx.delete(session).where(eq(session.userId, targetUserId)).run()
  })
  return {
    message: 'User archived successfully',
  }
})
