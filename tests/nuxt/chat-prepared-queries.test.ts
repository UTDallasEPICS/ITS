// @vitest-environment node
import { afterAll, expect, it, vi } from 'vitest'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { chatThreadMembers, chatThreadMessages, chatThreads, organization, project, user } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import { messageBelongsToThread, readMessagePage, readThreadPage, threadExists } from '../../server/utils/chat/internal/queries'

vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  return { db: drizzle(new Database(':memory:'), { schema }) }
})

migrate(db, { migrationsFolder: './drizzle' })
afterAll(() => db.$client.close())

it('prepares each read shape once and binds fresh values on subsequent calls', () => {
  db.insert(organization).values({ id: 'org', name: 'Partner' }).run()
  db.insert(project).values({ id: 1, name: 'Project', githubRepo: 'example/1', projectPartnerId: 'org' }).run()
  db.insert(user).values(['a', 'b'].map(id => ({ id, name: id, email: `${id}@example.com` }))).run()
  db.insert(chatThreads).values([{ id: 1, projectId: 1 }, { id: 2, projectId: 1 }]).run()
  db.insert(chatThreadMembers).values([{ threadId: 1, userId: 'a' }, { threadId: 2, userId: 'b' }]).run()
  db.insert(chatThreadMessages).values([11, 12, 13, 21, 22, 23].map(id => ({
    id, threadId: Math.floor(id / 10), userId: 'a', plainTextBody: `Message ${id}`,
  }))).run()

  const prepare = vi.spyOn(db.$client, 'prepare')
  try {
    for (const threadId of [1, 2]) {
      const base = threadId * 10
      expect(threadExists(threadId)).toBe(true)
      expect(threadExists(999)).toBe(false)
      expect(messageBelongsToThread(base + 1, threadId)).toBe(true)
      expect(messageBelongsToThread(base + 1, threadId === 1 ? 2 : 1)).toBe(false)
      for (const direction of ['oldest', 'latest'] as const) {
        const first = readMessagePage({ threadId, direction, limit: 2 })
        expect(first.map(row => row.id)).toEqual(direction === 'oldest'
          ? [base + 1, base + 2] : [base + 3, base + 2])
        const cursor = readMessagePage({ threadId, direction, cursorMessageId: base + 2, limit: 1 })
        expect(cursor.map(row => row.id)).toEqual([base + (direction === 'oldest' ? 3 : 1)])
      }
      const userId = threadId === 1 ? 'a' : 'b'
      expect(readThreadPage({ userId, limit: 1 }).map(row => row.id)).toEqual([threadId])
      expect(readThreadPage({ userId, afterThreadId: 1, limit: 1 }).map(row => row.id))
        .toEqual(threadId === 1 ? [] : [2])
    }
    expect(prepare).toHaveBeenCalledTimes(8)
  } finally {
    prepare.mockRestore()
  }
})
