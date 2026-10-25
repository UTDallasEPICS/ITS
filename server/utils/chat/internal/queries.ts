import { and, count, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm'
import {
  chatThreadMembers,
  chatThreadMessages,
  chatThreads,
  type insertChatThreadMembersSchema,
  type insertChatThreadsSchema,
  type selectChatThreadsSchema,
} from '../../../db/schema'
import { db } from '../../db'

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

function lazyQuery<T>(prepare: () => T) {
  let query: T | undefined
  return () => query ??= prepare()
}

const threadLookup = lazyQuery(() => db.select({ id: chatThreads.id }).from(chatThreads)
  .where(eq(chatThreads.id, sql.placeholder('threadId'))).limit(1).prepare())

const messageLookup = lazyQuery(() => db.select({ id: chatThreadMessages.id }).from(chatThreadMessages)
  .where(and(
    eq(chatThreadMessages.id, sql.placeholder('messageId')),
    eq(chatThreadMessages.threadId, sql.placeholder('threadId')),
  )).limit(1).prepare())

export const threadExists = (threadId: number) => !!threadLookup().get({ threadId })

export const messageBelongsToThread = (messageId: number, threadId: number) =>
  !!messageLookup().get({ messageId, threadId })

function messagePage(direction: 'latest' | 'oldest', withCursor: boolean) {
  const conditions = [eq(chatThreadMessages.threadId, sql.placeholder('threadId'))]
  if (withCursor) {
    const compare = direction === 'oldest' ? gt : lt
    conditions.push(compare(chatThreadMessages.id, sql.placeholder('cursorMessageId')))
  }

  return db.query.chatThreadMessages.findMany({
    where: and(...conditions),
    orderBy: direction === 'oldest' ? chatThreadMessages.id : desc(chatThreadMessages.id),
    limit: sql.placeholder('limit'),
  }).prepare()
}

const messagePages = {
  latest: {
    first: lazyQuery(() => messagePage('latest', false)),
    cursor: lazyQuery(() => messagePage('latest', true)),
  },
  oldest: {
    first: lazyQuery(() => messagePage('oldest', false)),
    cursor: lazyQuery(() => messagePage('oldest', true)),
  },
}

export function readMessagePage(data: {
  threadId: number
  direction: 'latest' | 'oldest'
  cursorMessageId?: number
  limit: number
}) {
  const pages = messagePages[data.direction]
  const query = data.cursorMessageId === undefined ? pages.first : pages.cursor
  return query().all(data)
}

function threadPage(withCursor: boolean) {
  const conditions = [eq(chatThreadMembers.userId, sql.placeholder('userId'))]
  if (withCursor) {
    conditions.push(gt(chatThreadMembers.threadId, sql.placeholder('afterThreadId')))
  }

  return db.query.chatThreadMembers.findMany({
    where: and(...conditions),
    with: { thread: true },
    orderBy: chatThreadMembers.threadId,
    limit: sql.placeholder('limit'),
  }).prepare()
}

const threadPages = {
  first: lazyQuery(() => threadPage(false)),
  cursor: lazyQuery(() => threadPage(true)),
}

export function readThreadPage(data: { userId: string, afterThreadId?: number, limit: number }) {
  const query = data.afterThreadId === undefined ? threadPages.first : threadPages.cursor
  return query().all(data).map(row => row.thread)
}
