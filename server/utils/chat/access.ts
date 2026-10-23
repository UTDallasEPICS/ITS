import { and, eq } from 'drizzle-orm'
import { createError } from 'h3'
import { chatThreadMembers, chatThreads } from '../../db/schema'
import { getUserOrgId, requireProjectAccess } from '../authorization'
import { db } from '../db'

/**
 * Resolves a thread only if the user may see it.
 *
 * Project access is the outer gate: NPTS passes for every project, partners
 * only for their organization's projects. Inside a project, partners must also
 * be a member of the thread; NPTS replies without being a member, which is why
 * membership lives here and not in the chat service (#56 keeps the service
 * auth-free so the widget's token path can reuse it).
 *
 * Missing threads and threads the user is not a member of both return 404 so
 * ids cannot be used to probe for other partners' conversations.
 */
export async function requireThreadAccess(userId: string, threadId: number) {
  const thread = db.select().from(chatThreads).where(eq(chatThreads.id, threadId)).get()

  if (!thread) {
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' })
  }

  await requireProjectAccess(userId, thread.projectId)

  const orgId = await getUserOrgId(userId)
  if (orgId === null) {
    return thread
  }

  const membership = db
    .select({ userId: chatThreadMembers.userId })
    .from(chatThreadMembers)
    .where(and(eq(chatThreadMembers.threadId, threadId), eq(chatThreadMembers.userId, userId)))
    .get()

  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' })
  }

  return thread
}
