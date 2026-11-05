import { requireUser } from '../utils/session'
import { getUserOrgId, isAdmin } from '../utils/authorization'

export default defineEventHandler(async (event) => {
  const currentUser = requireUser(event)
  const orgId = await getUserOrgId(currentUser.id)

  return {
    isAdmin: isAdmin(orgId),
  }
})
