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
  readMessagePage,
  readThreadPage,
  threadExists,
} from './internal/queries'

export type Result<T, E> = { ok: true, value: T } | { ok: false, error: E }

type PaginationError = 'invalid-page-size' | 'thread-not-found' | 'invalid-cursor'

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

export const getOrCreateThread = async (data: CreateThreadInput): Promise<Result<CreateThreadOutput, never>> => {
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

  return { ok: true, value: result }
}

export const sendMessage = async (data: insertChatThreadMessagesSchema): Promise<Result<selectChatThreadMessagesSchema, 'thread-not-found'>> => {
  if (!threadExists(data.threadId)) {
    return { ok: false, error: 'thread-not-found' }
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

  return { ok: true, value: message }
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

export const paginateThreadMessages = async (data: PaginateThreadMessagesInput): Promise<Result<PaginateThreadMessagesOutput, PaginationError>> => {
  if (!validPageSize(data.pageSize)) return { ok: false, error: 'invalid-page-size' }

  const resolvedPageSize = data.pageSize ?? THREAD_PAGE_MAX

  if (!threadExists(data.threadId)) {
    return { ok: false, error: 'thread-not-found' }
  }

  if (data.cursorMessageId !== undefined && !messageBelongsToThread(data.cursorMessageId, data.threadId)) {
    return { ok: false, error: 'invalid-cursor' }
  }

  const readingForward = data.direction === 'oldest'

  const rows = readMessagePage({ ...data, limit: resolvedPageSize + 1 })

  // The extra row only tells us whether another page exists in the direction we
  // are reading, so it never reaches the caller.
  const hasMore = rows.length > resolvedPageSize
  const page = hasMore ? rows.slice(0, resolvedPageSize) : rows

  return {
    ok: true,
    value: { messages: readingForward ? page : [...page].reverse(), metadata: { hasMore } },
  }
}

type ListThreadsInput = {
  userId: string
  afterThreadId?: selectChatThreadsSchema["id"]
  pageSize?: number
}

type ListThreadsOutput = {
  threads: selectChatThreadsSchema[],
  metadata: {
    hasMore: boolean
  }
}

export const listThreadsForUser = async (data: ListThreadsInput): Promise<Result<ListThreadsOutput, 'invalid-page-size'>> => {
  if (!validPageSize(data.pageSize)) return { ok: false, error: 'invalid-page-size' }

  const resolvedPageSize = data.pageSize ?? THREAD_PAGE_MAX

  const rows = readThreadPage({ ...data, limit: resolvedPageSize + 1 })

  const hasMore = rows.length > resolvedPageSize
  const page = hasMore ? rows.slice(0, resolvedPageSize) : rows

  return { ok: true, value: { threads: page, metadata: { hasMore } } }
}

function validPageSize(size: number | undefined) {
  return size === undefined || (Number.isInteger(size) && size > 0 && size <= THREAD_PAGE_MAX)
}
