import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'
import { requireUser } from '../../utils/session'
import { requireAdmin } from '../../utils/authorization'
import { db } from '../../utils/db'
import { user } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { validateOrganization } from '../../utils/user-validation'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default defineEventHandler(async (event) => {
  // guard
  const currentUser = requireUser(event)
  await requireAdmin(currentUser.id)

  const body = (await readBody(event)) ?? {}
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
    })
  }
  const { name, email, orgId, role } = body as {
    name?: unknown
    email?: unknown
    orgId?: unknown
    role?: unknown
  }

  if (role !== undefined && role !== 'admin' && role !== 'partner') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid role',
    })
  }

  // Validate the name and email
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

  if (!EMAIL_PATTERN.test(email.trim())) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid email',
    })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const isNptsEmail = normalizedEmail.endsWith('@npts.tech')
  // The NPTS domain always maps to an administrator. Otherwise the caller may
  // request an administrator explicitly, or create a partner with an organization.
  const isAdminUser = isNptsEmail || role === 'admin'
  const validatedOrgId = isAdminUser ? null : await validateOrganization(orgId)

  if (!isAdminUser && validatedOrgId === null) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Partner users must belong to an organization',
    })
  }

  // Check if the email already exists
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
  // Create the new user
  const [newUser] = await db
    .insert(user)
    .values({
      name: name.trim(),
      email: normalizedEmail,
      orgId: validatedOrgId,
    })
    .returning({
      id: user.id,
      name: user.name,
      email: user.email,
      orgId: user.orgId,
    })
  // Set the response status to 201 (Created)
  setResponseStatus(event, 201)
  return {
    message: 'User created successfully',
    user: newUser,
  }
})
