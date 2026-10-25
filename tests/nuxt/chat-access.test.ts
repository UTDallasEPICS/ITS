// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { chatThreadMembers, chatThreads, organization, project, user } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import { requireThreadAccess } from '../../server/utils/chat/access'

vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')
  const client = new Database(':memory:')
  return { db: drizzle(client, { schema }) }
})

migrate(db, { migrationsFolder: './drizzle' })
db.$client.pragma('foreign_keys = ON')

let threadId: number

beforeEach(() => {
  db.delete(chatThreadMembers).run()
  db.delete(chatThreads).run()
  db.delete(project).run()
  db.delete(user).run()
  db.delete(organization).run()

  db.insert(organization).values([
    { id: 'org', name: 'Partner' },
    { id: 'other', name: 'Other partner' },
  ]).run()
  db.insert(project).values({
    id: 1, name: 'Project 1', githubRepo: 'example/1', projectPartnerId: 'org',
  }).run()
  // orgId null is NPTS; a non-null orgId marks a partner account.
  db.insert(user).values([
    { id: 'npts', name: 'NPTS', email: 'npts@example.com' },
    { id: 'member', name: 'Member', email: 'member@example.com', orgId: 'org' },
    { id: 'peer', name: 'Peer', email: 'peer@example.com', orgId: 'org' },
    { id: 'outsider', name: 'Outsider', email: 'outsider@example.com', orgId: 'other' },
  ]).run()

  threadId = db.insert(chatThreads).values({ projectId: 1 }).returning().get()!.id
  db.insert(chatThreadMembers).values({ threadId, userId: 'member' }).run()
})

afterAll(() => db.$client.close())

describe('requireThreadAccess', () => {
  it('lets NPTS into a thread they are not a member of', async () => {
    await expect(requireThreadAccess('npts', threadId)).resolves.toMatchObject({ id: threadId })
  })

  it('lets a member of the thread in', async () => {
    await expect(requireThreadAccess('member', threadId)).resolves.toMatchObject({ id: threadId })
  })

  it('hides the thread from a same-org partner who is not a member', async () => {
    await expect(requireThreadAccess('peer', threadId)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('hides a thread from another organization', async () => {
    await expect(requireThreadAccess('outsider', threadId)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns 404 for a thread that does not exist', async () => {
    await expect(requireThreadAccess('npts', 999)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('hides a thread even if a different-organization partner was added as a member', async () => {
    db.insert(chatThreadMembers).values({ threadId, userId: 'outsider' }).run()
    await expect(requireThreadAccess('outsider', threadId)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('does not treat a missing user as NPTS', async () => {
    await expect(requireThreadAccess('missing', threadId)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('executes one authorization query for every outcome', async () => {
    for (const [userId, id] of [
      ['npts', threadId], ['member', threadId], ['peer', threadId],
      ['outsider', threadId], ['member', 999], ['missing', threadId],
    ] as const) {
      const prepare = vi.spyOn(db.$client, 'prepare')
      try {
        await requireThreadAccess(userId, id).catch(() => undefined)
        expect(prepare).toHaveBeenCalledTimes(1)
      } finally {
        prepare.mockRestore()
      }
    }
  })
})
