// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { organization, project, user } from '../../server/db/schema'
import { db } from '../../server/utils/db'
import { requireProjectAccess } from '../../server/utils/authorization'

// Use an in-memory SQLite database for testing.
vi.mock('../../server/utils/db', async () => {
  const { default: Database } = await import('better-sqlite3')
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('../../server/db/schema')

  return { db: drizzle(new Database(':memory:'), { schema }) }
})

migrate(db, { migrationsFolder: './drizzle' })

db.$client.pragma('foreign_keys = ON')

describe('Project Authorization', () => {
  beforeEach(() => {
    // Reset test data.
    db.delete(project).run()
    db.delete(user).run()
    db.delete(organization).run()

    // Create partner organizations.
    db.insert(organization)
      .values([
        { id: 'org-a', name: 'Partner A' },
        { id: 'org-b', name: 'Partner B' },
      ])
      .run()

    // Create test users.
    db.insert(user)
      .values([
        {
          id: 'npts',
          name: 'NPTS Admin',
          email: 'admin@example.com',
          orgId: null,
        },
        {
          id: 'partner-a',
          name: 'Partner A',
          email: 'a@example.com',
          orgId: 'org-a',
        },
        {
          id: 'partner-b',
          name: 'Partner B',
          email: 'b@example.com',
          orgId: 'org-b',
        },
      ])
      .run()

    // Create projects assigned to different partners.
    db.insert(project)
      .values([
        {
          id: 1,
          name: 'Website A',
          githubRepo: 'example/a',
          projectPartnerId: 'org-a',
        },
        {
          id: 2,
          name: 'Website B',
          githubRepo: 'example/b',
          projectPartnerId: 'org-b',
        },
      ])
      .run()
  })

  afterAll(() => {
    db.$client.close()
  })

  it('allows NPTS admin to access any project', async () => {
    await expect(requireProjectAccess('npts', 1)).resolves.toBeUndefined()
    await expect(requireProjectAccess('npts', 2)).resolves.toBeUndefined()
  })

  it('allows a partner to access an assigned project', async () => {
    await expect(requireProjectAccess('partner-a', 1)).resolves.toBeUndefined()
  })

  it('denies a partner access to an unassigned project', async () => {
    await expect(requireProjectAccess('partner-a', 2)).rejects.toMatchObject({
      statusCode: 403,
    })
  })
})
