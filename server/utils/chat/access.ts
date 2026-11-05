import { and, eq, exists, isNull, or, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { chatThreadMembers, chatThreads, project, user } from '../../db/schema'
import { db } from '../db'

export async function requireThreadAccess(userId: string, threadId: number) {
  const membership = db.select({ value: sql`1` }).from(chatThreadMembers).where(and(
    eq(chatThreadMembers.threadId, chatThreads.id),
    eq(chatThreadMembers.userId, userId),
  ))
  const [row] = await db.select({ thread: chatThreads }).from(chatThreads)
    .innerJoin(project, eq(project.id, chatThreads.projectId))
    .innerJoin(user, eq(user.id, userId))
    .where(and(
      eq(chatThreads.id, threadId),
      exists(membership),
      or(
        isNull(user.orgId),
        eq(user.orgId, project.projectPartnerId),
      ),
    ))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Thread not found' })
  return row.thread
}
