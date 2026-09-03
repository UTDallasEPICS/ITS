import { db } from '../../utils/db'
import { user } from '../../db/schema'

export default defineEventHandler(async () => {
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
