import { createAuthClient } from 'better-auth/vue'
import { emailOTPClient, organizationClient, adminClient } from 'better-auth/client/plugins'
import { ac, roles } from '#shared/access-control'

export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    organizationClient({ ac, roles }),
    adminClient(),
  ],
})
