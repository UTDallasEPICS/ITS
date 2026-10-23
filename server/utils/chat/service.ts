import { desc } from 'drizzle-orm'
import { z } from 'zod'
import {
  chatThreadMembers,
  chatThreadMessages,
  chatThreads,
  type insertChatThreadMembersSchema,
  type insertChatThreadMessagesSchema,
  type insertChatThreadsSchema,
  type selectChatThreadMessagesSchema,
  type selectChatThreadsSchema,
} from '../../db/schema'
import { db } from '../db'
import { emitChatMessage, emitChatThreadCreated } from './events'
import {
  findOpenThreadWithThisSetOfMembers,
  messageBelongsToThread,
  threadExists,
  userIsMemberOfThread,
} from './queries'

export const chatPageDirectionSchema = z.enum(['latest', 'oldest'])

export type ChatPageDirection = z.infer<typeof chatPageDirectionSchema>

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

  const result = db.transaction((trx): CreateThreadOutput => {
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

  if (result.created) {
    try {
      await emitChatThreadCreated(result.thread, allMembers)
    } catch (error) {
      console.error('[chat] failed to emit chat:thread-created', error)
    }
  }

  return result
}

export const sendMessage = async (data: insertChatThreadMessagesSchema) => {
  if (!userIsMemberOfThread(data.userId, data.threadId)) {
    throw new Error("Thread does not exist")
  }

  const message = await db.insert(chatThreadMessages).values(data).returning().get()
  if (!message) {
    throw new Error("Failed to insert chat message.")
  }

  try {
    await emitChatMessage(message)
  } catch (error) {
    console.error('[chat] failed to emit chat:message', error)
  }

  return message
}

type PaginateThreadMessagesInput = {
  threadId: selectChatThreadMessagesSchema["threadId"]
  direction: ChatPageDirection
  cursorMessageId?: selectChatThreadMessagesSchema["id"]
  pageSize?: number
}

type PaginateThreadMessagesOutput = {
  messages: selectChatThreadMessagesSchema[],
  metadata: {
    hasMore: boolean
  }
}

const THREAD_PAGE_MAX = 25

export const paginateThreadMessages = async (data: PaginateThreadMessagesInput): Promise<PaginateThreadMessagesOutput> => {
  if (data.pageSize !== undefined) {
    if (data.pageSize <= 0) throw new Error("page size must be at least 1")
    if (data.pageSize > THREAD_PAGE_MAX) throw new Error(`page size must be less than ${THREAD_PAGE_MAX}`)
  }

  const resolvedPageSize = data.pageSize ?? THREAD_PAGE_MAX

  if (!threadExists(data.threadId)) {
    throw new Error("Thread does not exist")
  }

  if (data.cursorMessageId !== undefined && !messageBelongsToThread(data.cursorMessageId, data.threadId)) {
    throw new Error("Invalid cursor")
  }

  const readingForward = data.direction === 'oldest'

  const rows = await db.query.chatThreadMessages.findMany({
    where: (message, builder) => builder.and(
      builder.eq(message.threadId, data.threadId),
      data.cursorMessageId === undefined
        ? undefined
        : readingForward
          ? builder.gt(message.id, data.cursorMessageId)
          : builder.lt(message.id, data.cursorMessageId),
    ),
    limit: resolvedPageSize + 1,
    orderBy: readingForward ? chatThreadMessages.id : desc(chatThreadMessages.id)
  })

  // The extra row only tells us whether another page exists in the direction we
  // are reading, so it never reaches the caller.
  const hasMore = rows.length > resolvedPageSize
  const page = hasMore ? rows.slice(0, resolvedPageSize) : rows

  return {
    messages: readingForward ? page : [...page].reverse(), metadata: {
     hasMore
    }
  }
}
