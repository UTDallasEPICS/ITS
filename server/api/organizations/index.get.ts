import { asc } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { organization } from '../../db/schema'
import { requireAdmin } from '../../utils/authorization'
import { db } from '../../utils/db'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const currentUser = requireUser(event)
  await requireAdmin(currentUser.id)

  return db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .orderBy(asc(organization.name), asc(organization.id))
    .all()
})
