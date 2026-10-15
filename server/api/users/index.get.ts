import { db } from '../../utils/db'
import { user } from '../../db/schema'
// for guard
import { requireUser } from '../../utils/session'
import { requireAdmin } from '../../utils/authorization'

export default defineEventHandler(async (event) => {
  // guard
  const currentUser = requireUser(event)
  await requireAdmin(currentUser.id)

  const users = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
    })
    .from(user)

  const redacted = users.map((u) => {
    return {
      ...u,
      image: u.image != null,
    }
  })

  return redacted
})
