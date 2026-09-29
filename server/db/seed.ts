import 'dotenv/config'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!.replace('file:', '')
const sqlite = new Database(connectionString)
const db = drizzle(sqlite, { schema })

const USER_EMAIL = 'seeded-user@email.com'
const ORG_SLUG = 'seeded-org'

type SeededUser = typeof schema.user.$inferSelect
type SeededOrganization = typeof schema.organization.$inferSelect

// Every step checks for an existing row first so the seed is safe to re-run.
// `member` has no unique index on (organizationId, userId), so an
// upsert-style insert would add a duplicate row on each run.
async function seedUser(): Promise<SeededUser> {
  const existing = await db.query.user.findFirst({ where: (u, { eq }) => eq(u.email, USER_EMAIL) })

  if (existing) {
    console.log({ user: existing })
    return existing
  }

  const [created] = await db
    .insert(schema.user)
    .values({ email: USER_EMAIL, name: 'Sample Seeded User' })
    .returning()

  if (!created) {
    throw new Error(`failed to seed user ${USER_EMAIL}`)
  }

  console.log({ user: created })
  return created
}

async function seedOrganization(): Promise<SeededOrganization> {
  const existing = await db.query.organization.findFirst({
    where: (o, { eq }) => eq(o.slug, ORG_SLUG),
  })

  if (existing) {
    console.log({ organization: existing })
    return existing
  }

  const [created] = await db
    .insert(schema.organization)
    .values({ name: 'Sample Seeded Organization', slug: ORG_SLUG })
    .returning()

  if (!created) {
    throw new Error(`failed to seed organization ${ORG_SLUG}`)
  }

  console.log({ organization: created })
  return created
}

// The organization plugin grants the creator 'owner'; mirror that so the seeded
// user passes membership checks against the seeded organization.
async function seedMembership(user: SeededUser, organization: SeededOrganization) {
  const existing = await db.query.member.findFirst({
    where: (m, { and, eq }) => and(eq(m.organizationId, organization.id), eq(m.userId, user.id)),
  })

  if (existing) {
    console.log({ member: existing })
    return
  }

  const [created] = await db
    .insert(schema.member)
    .values({ organizationId: organization.id, userId: user.id, role: 'owner' })
    .returning()

  console.log({ member: created })
}

async function main() {
  console.log('Start seeding...')

  const user = await seedUser()
  const organization = await seedOrganization()

  await seedMembership(user, organization)

  console.log('Seeding finished.')
}

main()
  .then(() => {
    sqlite.close()
  })
  .catch((e) => {
    console.error(e)
    sqlite.close()
    process.exit(1)
  })
