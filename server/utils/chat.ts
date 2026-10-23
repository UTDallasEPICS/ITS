import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  chatThreadMembers,
  chatThreadMessages,
  chatThreads,
  type insertChatThreadMembersSchema,
  type insertChatThreadMessagesSchema,
  type insertChatThreadsSchema,
  type selectChatThreadMessagesSchema,
  type selectChatThreadsSchema,
} from '../db/schema'
import { db } from './db'

type ChatTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

const findOpenThreadWithThisSetOfMembers = (
  trx: ChatTransaction,
  projectId: CreateThreadInput['projectId'],
  members: CreateThreadInput['otherMembers'],
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

type CreateThreadInput = {
  projectId: insertChatThreadsSchema["projectId"],
  initialMessage: Omit<insertChatThreadMessagesSchema, "threadId" | "createdAt" | "id">,
  otherMembers: insertChatThreadMembersSchema["userId"][]
}


type CreateThreadOutput = {
  created: boolean,
  thread: selectChatThreadsSchema
}

export const getOrCreateThread = async (data: CreateThreadInput): Promise<CreateThreadOutput> => {
  const allMembers = [...new Set([...data.otherMembers, data.initialMessage.userId])]

  return db.transaction((trx): CreateThreadOutput => {
    const existingThread = findOpenThreadWithThisSetOfMembers(trx, data.projectId, allMembers)
    if (existingThread) {
      return { created: false, thread: existingThread }
    }

    const thread = trx
      .insert(chatThreads)
      .values({ projectId: data.projectId })
      .returning()
      .get()
    if (!thread) {
      throw new Error("Failed to insert chat thread record.")
    }

    trx
      .insert(chatThreadMembers)
      .values(allMembers.map(userId => ({ threadId: thread.id, userId })))
      .run()
    trx.insert(chatThreadMessages).values({ ...data.initialMessage, threadId: thread.id }).run()

    return { created: true, thread }
  }, { behavior: 'immediate' })
}

const userIsMemberOfThread = (userId: string, threadId: number): boolean => {
  const membershipRecord = db
    .select({ userId: chatThreadMembers.userId })
    .from(chatThreadMembers)
    .where(and(eq(chatThreadMembers.userId, userId), eq(chatThreadMembers.threadId, threadId)))
    .limit(1)
    .get()
  
  return !!membershipRecord
}

export const sendMessage = async (data: insertChatThreadMessagesSchema) => {
  if (!userIsMemberOfThread(data.userId, data.threadId)) {
    throw new Error("Thread does not exist")
  }
  const message = db.insert(chatThreadMessages).values(data).returning()

  // TODO: event emitter for websocket

  return message
}


type PaginateThreadMessagesInput = {
  threadId: selectChatThreadMessagesSchema["threadId"]
  startMessageId?: selectChatThreadMessagesSchema["id"]
  pageSize?: number
}

type PaginateThreadMessagesOutput = {
  messages: selectChatThreadMessagesSchema[],
  metadata: {
    hasMore: boolean
  }
}

const THREAD_PAGE_MAX = 25

const threadExists = (threadId: number): boolean => {
  const threadRecord = db
    .select({ id: chatThreads.id })
    .from(chatThreads)
    .where(eq(chatThreads.id, threadId))
    .limit(1)
    .get()

  return !!threadRecord
}

const messageBelongsToThread = (messageId: number, threadId: number): boolean => {
  const messageRecord = db
    .select({ id: chatThreadMessages.id })
    .from(chatThreadMessages)
    .where(and(eq(chatThreadMessages.id, messageId), eq(chatThreadMessages.threadId, threadId)))
    .limit(1)
    .get()

  return !!messageRecord
} 

export const paginateThreadMessages = async (data: PaginateThreadMessagesInput): Promise<PaginateThreadMessagesOutput> => {
  if (data.pageSize !== undefined) {
    if (data.pageSize <= 0) throw new Error("page size must be at least 1")
    if (data.pageSize > THREAD_PAGE_MAX) throw new Error(`page size must be less than ${THREAD_PAGE_MAX}`)
  }
  
  const resolvedPageSize = data.pageSize ?? THREAD_PAGE_MAX

  if (!threadExists(data.threadId)) {
    throw new Error("Thread does not exist")
  }

  if (data.startMessageId !== undefined && !messageBelongsToThread(data.startMessageId, data.threadId)) {
    throw new Error("Invalid cursor")
  }

  const messages = await db.query.chatThreadMessages.findMany({
    where: (message, builder) => builder.and(
      builder.eq(message.threadId, data.threadId),
      data.startMessageId !== undefined ? builder.gt(message.id, data.startMessageId) : undefined,
    ),
    limit: resolvedPageSize + 1,
    orderBy: chatThreadMessages.id
  })

  const hasMore = !!messages[resolvedPageSize]
  if (hasMore) {
    messages.pop()
  }
  return {
    messages, metadata: {
     hasMore
    }
  }
}
