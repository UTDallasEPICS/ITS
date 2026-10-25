import { requireUser } from '../../utils/session'
import { requireAdmin } from '../../utils/authorization'
import { db } from '../../utils/db'
import { user } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { validateOrganization } from '../../utils/user-validation'

export default defineEventHandler(async (event) => {
  // guard
  const currentUser = requireUser(event)
  await requireAdmin(currentUser.id)

  const body = await readBody(event)
  const { name, email, orgId } = body
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
  //  Validate the organization ID
  const validatedOrgId = await validateOrganization(orgId)

  const normalizedEmail = email.trim().toLowerCase()
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
