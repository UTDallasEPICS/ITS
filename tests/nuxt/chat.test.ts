// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { eq } from 'drizzle-orm'
import { chatThreadMembers, chatThreadMessages, chatThreads, organization, project, user } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import { getOrCreateThread, paginateThreadMessages, sendMessage } from '../../server/utils/chat'

const { statements } = vi.hoisted(() => ({ statements: [] as string[] }))

vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  const client = new Database(':memory:', { verbose: sql => statements.push(sql as string) })
  return { db: drizzle(client, { schema }) }
})

migrate(db, { migrationsFolder: './drizzle' })
db.$client.pragma('foreign_keys = ON')

const input = {
  projectId: 1,
  initialMessage: { userId: 'a', plainTextBody: 'Hello' },
  otherMembers: ['b'],
}

beforeEach(() => {
  db.delete(chatThreadMessages).run()
  db.delete(chatThreadMembers).run()
  db.delete(chatThreads).run()
  db.delete(project).run()
  db.delete(user).run()
  db.delete(organization).run()
  db.insert(organization).values({ id: 'org', name: 'Partner' }).run()
  db.insert(project).values([1, 2].map(id => ({
    id, name: `Project ${id}`, githubRepo: `example/${id}`, projectPartnerId: 'org',
  }))).run()
  db.insert(user).values(['a', 'b', 'c'].map(id => ({
    id, name: id, email: `${id}@example.com`,
  }))).run()
})

afterAll(() => db.$client.close())

describe('getOrCreateThread', () => {
  it('reserves the SQLite writer before looking up a thread, including on reuse', async () => {
    for (const created of [true, false]) {
      statements.length = 0
      const result = await getOrCreateThread(input)
      expect(result.created).toBe(created)
      expect(statements[0]).toBe('BEGIN IMMEDIATE')
      expect(statements[1]).toMatch(/^select /i)
      expect(statements.at(-1)).toBe('COMMIT')
    }
  })

  it('creates the thread, unique members, and initial message atomically', async () => {
    const result = await getOrCreateThread({ ...input, otherMembers: ['b', 'a', 'b'] })
    expect(result.created).toBe(true)
    expect(db.select().from(chatThreadMembers).all().map(row => row.userId).sort()).toEqual(['a', 'b'])
    expect(db.select().from(chatThreadMessages).all()).toEqual([
      expect.objectContaining({ threadId: result.thread.id, userId: 'a', plainTextBody: 'Hello' }),
    ])
  })

  it('reuses the exact member set regardless of order without inserting another message', async () => {
    const first = await getOrCreateThread(input)
    const second = await getOrCreateThread({
      ...input,
      initialMessage: { userId: 'b', plainTextBody: 'Another message' },
      otherMembers: ['a'],
    })
    expect(second).toEqual({ created: false, thread: first.thread })
    expect(db.select().from(chatThreads).all()).toHaveLength(1)
    expect(db.select().from(chatThreadMessages).all()).toHaveLength(1)
  })

  it('does not reuse a superset, subset, or different set with the same size', async () => {
    await getOrCreateThread({ ...input, otherMembers: ['b', 'c'] })
    await getOrCreateThread({ ...input, otherMembers: [] })
    await getOrCreateThread({ ...input, otherMembers: ['c'] })
    const result = await getOrCreateThread(input)
    expect(result.created).toBe(true)
    expect(db.select().from(chatThreads).all()).toHaveLength(4)
  })

  it('does not reuse a closed thread or a thread from another project', async () => {
    const first = await getOrCreateThread(input)
    db.update(chatThreads).set({ closedAt: new Date() }).where(eq(chatThreads.id, first.thread.id)).run()
    const reopened = await getOrCreateThread(input)
    const otherProject = await getOrCreateThread({ ...input, projectId: 2 })
    expect(reopened.created).toBe(true)
    expect(otherProject.created).toBe(true)
    expect(db.select().from(chatThreads).all()).toHaveLength(3)
  })

  it('rolls back thread and member creation when message insertion fails', async () => {
    db.$client.exec(`CREATE TRIGGER reject_message BEFORE INSERT ON chat_thread_messages
      BEGIN SELECT RAISE(ABORT, 'message rejected'); END`)
    try {
      await expect(getOrCreateThread(input)).rejects.toThrow()
      expect(db.select().from(chatThreads).all()).toHaveLength(0)
      expect(db.select().from(chatThreadMembers).all()).toHaveLength(0)
    } finally {
      db.$client.exec('DROP TRIGGER reject_message')
    }
  })
})

describe('sendMessage', () => {
  it('saves a member’s message with its sender and thread', async () => {
    const { thread } = await getOrCreateThread(input)
    await sendMessage({ threadId: thread.id, userId: 'b', plainTextBody: 'Reply from B' })
    expect(db.select().from(chatThreadMessages).all()).toEqual([
      expect.objectContaining({ threadId: thread.id, userId: 'a', plainTextBody: 'Hello' }),
      expect.objectContaining({ threadId: thread.id, userId: 'b', plainTextBody: 'Reply from B' }),
    ])
  })

  it('rejects a nonmember without saving their message', async () => {
    const { thread } = await getOrCreateThread(input)
    await expect(sendMessage({
      threadId: thread.id, userId: 'c', plainTextBody: 'Not a member',
    })).rejects.toThrow()
    expect(db.select().from(chatThreadMessages).all()).toHaveLength(1)
  })

  it('rejects a nonexistent thread without saving a message', async () => {
    await expect(sendMessage({
      threadId: 999, userId: 'a', plainTextBody: 'Missing thread',
    })).rejects.toThrow()
    expect(db.select().from(chatThreadMessages).all()).toHaveLength(0)
  })
})

function seedMessages(count: number) {
const thread = db.insert(chatThreads).values({ projectId: 1 }).returning().get()!
const messages = count === 0 ? [] : db.insert(chatThreadMessages).values(
  Array.from({ length: count }, (_, index) => ({
    threadId: thread.id, userId: 'a', plainTextBody: `Message ${index + 1}`,
  })),
).returning().all()
return { thread, messages }
}

describe('paginateThreadMessages', () => {
  it('returns an empty page for a thread without messages', async () => {
    const { thread } = seedMessages(0)
    expect(await paginateThreadMessages({ threadId: thread.id, direction: 'latest' })).toEqual({
      messages: [], metadata: { hasMore: false },
    })
  })

  it('defaults to the newest 25 messages when reading latest', async () => {
    const { thread, messages } = seedMessages(26)
    expect(await paginateThreadMessages({ threadId: thread.id, direction: 'latest' })).toEqual({
      messages: messages.slice(1), metadata: { hasMore: true },
    })
  })

  it('defaults to the oldest 25 messages when reading oldest', async () => {
    const { thread, messages } = seedMessages(26)
    expect(await paginateThreadMessages({ threadId: thread.id, direction: 'oldest' })).toEqual({
      messages: messages.slice(0, 25), metadata: { hasMore: true },
    })
  })

  it('returns only the requested thread’s messages in ascending ID order', async () => {
    const { thread } = seedMessages(0)
    seedMessages(2)
    const rows = db.insert(chatThreadMessages).values([30, 10, 20].map(id => ({
      id, threadId: thread.id, userId: 'a', plainTextBody: `Message ${id}`,
    }))).returning().all()
    const result = await paginateThreadMessages({
      threadId: thread.id, direction: 'latest', pageSize: 2,
    })
    expect(result).toEqual({
      messages: rows.sort((a, b) => a.id - b.id).slice(1), metadata: { hasMore: true },
    })
  })

  it('reports no more messages when the page exactly fits', async () => {
    const { thread, messages } = seedMessages(2)
    expect(await paginateThreadMessages({
      threadId: thread.id, direction: 'latest', pageSize: 2,
    })).toEqual({
      messages, metadata: { hasMore: false },
    })
  })

  it('walks forward to the final partial page without gaps or duplicates', async () => {
    const { thread, messages } = seedMessages(5)
    const first = await paginateThreadMessages({
      threadId: thread.id, direction: 'oldest', pageSize: 2,
    })
    const second = await paginateThreadMessages({
      threadId: thread.id, direction: 'oldest', pageSize: 2, cursorMessageId: first.messages.at(-1)!.id,
    })
    const last = await paginateThreadMessages({
      threadId: thread.id, direction: 'oldest', pageSize: 2, cursorMessageId: second.messages.at(-1)!.id,
    })
    expect([...first.messages, ...second.messages, ...last.messages]).toEqual(messages)
    expect([first.metadata.hasMore, second.metadata.hasMore, last.metadata.hasMore]).toEqual([
      true, true, false,
    ])
    expect(last.messages).toHaveLength(1)
  })

  it('walks backward from the newest message to the first page', async () => {
    const { thread, messages } = seedMessages(5)
    const newest = await paginateThreadMessages({
      threadId: thread.id, direction: 'latest', pageSize: 2,
    })
    const middle = await paginateThreadMessages({
      threadId: thread.id, direction: 'latest', pageSize: 2, cursorMessageId: newest.messages[0]!.id,
    })
    const oldest = await paginateThreadMessages({
      threadId: thread.id, direction: 'latest', pageSize: 2, cursorMessageId: middle.messages[0]!.id,
    })
    expect([...oldest.messages, ...middle.messages, ...newest.messages]).toEqual(messages)
    expect([newest.metadata.hasMore, middle.metadata.hasMore, oldest.metadata.hasMore]).toEqual([
      true, true, false,
    ])
    expect(oldest.messages).toHaveLength(1)
  })

  it('returns an empty page after the last message when reading forward', async () => {
    const { thread, messages } = seedMessages(2)
    expect(await paginateThreadMessages({
      threadId: thread.id, direction: 'oldest', cursorMessageId: messages.at(-1)!.id,
    })).toEqual({ messages: [], metadata: { hasMore: false } })
  })

  it('returns an empty page before the first message when reading backward', async () => {
    const { thread, messages } = seedMessages(2)
    expect(await paginateThreadMessages({
      threadId: thread.id, direction: 'latest', cursorMessageId: messages[0]!.id,
    })).toEqual({ messages: [], metadata: { hasMore: false } })
  })

  it('rejects a cursor belonging to another thread', async () => {
    const { thread } = seedMessages(2)
    const other = seedMessages(1)
    await expect(paginateThreadMessages({
      threadId: thread.id, direction: 'latest', cursorMessageId: other.messages[0]!.id,
    })).rejects.toThrow()
  })

  it('rejects a nonexistent cursor', async () => {
    const { thread } = seedMessages(2)
    await expect(paginateThreadMessages({
      threadId: thread.id, direction: 'oldest', cursorMessageId: 999,
    })).rejects.toThrow()
  })

  it.each([0, -1, 26])('rejects an out-of-range page size of %s', async pageSize => {
    const { thread } = seedMessages(1)
    await expect(paginateThreadMessages({
      threadId: thread.id, direction: 'latest', pageSize,
    })).rejects.toThrow()
  })
})
