import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  chatThreadMembers,
  chatThreadMessages,
  chatThreads,
  type insertChatThreadMembersSchema,
  type insertChatThreadsSchema,
  type selectChatThreadsSchema,
} from '../../db/schema'
import { db } from '../db'

type ChatTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export const findOpenThreadWithThisSetOfMembers = (
  trx: ChatTransaction,
  projectId: insertChatThreadsSchema['projectId'],
  members: insertChatThreadMembersSchema['userId'][],
): selectChatThreadsSchema | null => {
  const memberIds = [...new Set(members)]
  if (memberIds.length === 0) return null

  const matchingThreadIdSubquery = trx
    .select({ threadId: chatThreadMembers.threadId })
    .from(chatThreadMembers)
    .groupBy(chatThreadMembers.threadId)
    .having(
      and(
        eq(count(), memberIds.length),
        eq(
          sql<number>`sum(case when ${inArray(chatThreadMembers.userId, memberIds)} then 1 else 0 end)`,
          memberIds.length,
        ),
      ),
    )

  return (
    trx
      .select()
      .from(chatThreads)
      .where(
        and(
          eq(chatThreads.projectId, projectId),
          isNull(chatThreads.closedAt),
          inArray(chatThreads.id, matchingThreadIdSubquery),
        ),
      )
      .orderBy(chatThreads.id)
      .limit(1)
      .get() ?? null
  )
}

export const threadExists = (threadId: number): boolean => {
  const threadRecord = db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(eq(chatThreads.id, threadId))
    .limit(1)
    .get()

  return !!threadRecord
}

export const messageBelongsToThread = (messageId: number, threadId: number): boolean => {
  const messageRecord = db
    .select({ id: chatThreadMessages.id })
    .from(chatThreadMessages)
    .where(and(eq(chatThreadMessages.id, messageId), eq(chatThreadMessages.threadId, threadId)))
    .limit(1)
    .get()

  return !!messageRecord
}
