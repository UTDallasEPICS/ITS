import { requireUser } from '../../utils/session'
import { requireAdmin } from '../../utils/authorization'
import { db } from '../../utils/db'
import { organization, user } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const currentUser = requireUser(event)
  await requireAdmin(currentUser.id)

  const body = await readBody(event)
  const { name, email, orgId } = body

  if (
    typeof name !== 'string' ||
    name.trim() === '' ||
    typeof email !== 'string' ||
    email.trim() === ''
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid name or email',
    })
  }

  if (orgId !== null && (typeof orgId !== 'string' || orgId.trim() === '')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid organization ID',
    })
  }

  if (orgId !== null) {
    const [foundOrg] = await db.select().from(organization).where(eq(organization.id, orgId))

    if (!foundOrg) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organization not found',
      })
    }
  }

  const normalizedEmail = email.trim().toLowerCase()

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalizedEmail))

  if (existingUser) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Email already exists',
    })
  }

  const [newUser] = await db
    .insert(user)
    .values({
      name: name.trim(),
      email: normalizedEmail,
      orgId: orgId,
    })
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      orgId: user.orgId,
    })

  setResponseStatus(event, 201)
  return {
    message: 'User created successfully',
    user: newUser,
  }
})
