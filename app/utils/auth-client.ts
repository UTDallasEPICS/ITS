import { createAuthClient } from 'better-auth/vue'
import { emailOTPClient, organizationClient, adminClient } from 'better-auth/client/plugins'
import { ac, roles } from '#shared/access-control'

export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    // `ac` and `roles` only exist so `hasPermission` is type-checked against the
    // resources declared in shared/access-control.ts; they are not sent over the
    // wire. They must stay in sync with the server's organization() options.
    organizationClient({ ac, roles }),
    adminClient(),
  ],
})
