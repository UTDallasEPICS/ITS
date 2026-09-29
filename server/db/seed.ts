import 'dotenv/config'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL!.replace('file:', '')
const sqlite = new Database(connectionString)
const db = drizzle(sqlite, { schema })

const USER_EMAIL = 'seeded-user@email.com'
const PARTNER_SLUG = 'seeded-org'
const PARTNER_NAME = 'Sample Seeded Project Partner'

type SeededUser = typeof schema.user.$inferSelect
// An organization is a project partner. The table keeps the Better Auth model
// name, so the seed calls it by what it means here.
type SeededProjectPartner = typeof schema.organization.$inferSelect

// Every step checks for an existing row first so the seed is safe to re-run.
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

async function seedProjectPartner(): Promise<SeededProjectPartner> {
  const existing = await db.query.organization.findFirst({
    where: (o, { eq }) => eq(o.slug, PARTNER_SLUG),
  })

  if (existing) {
    console.log({ projectPartner: existing })
    return existing
  }

  const [created] = await db
    .insert(schema.organization)
    .values({ name: PARTNER_NAME, slug: PARTNER_SLUG })
    .returning()

  if (!created) {
    throw new Error(`failed to seed project partner ${PARTNER_SLUG}`)
  }

  console.log({ projectPartner: created })
  return created
}

// The organization plugin grants the creator 'owner'; mirror that so the seeded
// user passes membership checks against the seeded partner. The unique index on
// (organizationId, userId) makes the insert a no-op when the row already exists.
async function seedMembership(user: SeededUser, partner: SeededProjectPartner) {
  const [created] = await db
    .insert(schema.member)
    .values({ organizationId: partner.id, userId: user.id, role: 'owner' })
    .onConflictDoNothing()
    .returning()

  const membership =
    created ??
    (await db.query.member.findFirst({
      where: (m, { and, eq }) => and(eq(m.organizationId, partner.id), eq(m.userId, user.id)),
    }))

  if (!membership) {
    throw new Error(`failed to seed membership for ${user.id} in ${partner.id}`)
  }

  console.log({ member: membership })
}

async function main() {
  console.log('Start seeding...')

  const user = await seedUser()
  const partner = await seedProjectPartner()

  await seedMembership(user, partner)

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
