import { createAuthClient } from 'better-auth/vue'
import { emailOTPClient, organizationClient, adminClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), organizationClient(), adminClient()],
})
