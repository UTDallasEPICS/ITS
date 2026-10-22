import { eq } from 'drizzle-orm'
import { db } from './db'
import { organization } from '../db/schema'

export async function validateOrganization(orgId: unknown) {
  if (orgId !== null && (typeof orgId !== 'string' || orgId.trim() === '')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid organization ID',
    })
  }

  if (orgId === null) {
    return null
  }

  const [foundOrg] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, orgId))

  if (!foundOrg) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Organization not found',
    })
  }

  return orgId
}
