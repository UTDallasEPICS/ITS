# Authorization Guards — Usage Guide

## Overview

NPTS uses reusable server-side authorization guards to control access to protected API routes.

- **Admin:** A user whose `orgId` is `null`.
- **Partner:** A user whose `orgId` references an organization.
- **Authentication:** Verifies that a user is signed in.
- **Authorization:** Verifies that the signed-in user has permission to access a resource.

## 1. Admin-Only API Routes

Use `requireAdmin()` to restrict an API endpoint to administrators.

```ts
import { requireUser } from '../../utils/session'
import { requireAdmin } from '../../utils/authorization'

export default defineEventHandler(async (event) => {
  const currentUser = requireUser(event)

  await requireAdmin(currentUser.id)

  // Admin-only operations go here.
  return { success: true }
})
```

## 2. Project Access

Use `requireProjectAccess()` to check whether a user can access a specific project.

```ts
import { requireUser } from '../../utils/session'
import { requireProjectAccess } from '../../utils/authorization'

export default defineEventHandler(async (event) => {
  const currentUser = requireUser(event)
  const projectId = Number(getRouterParam(event, 'id'))

  await requireProjectAccess(currentUser.id, projectId)

  // Project-specific operations go here.
  return { success: true }
})
```

The project ID must be validated before passing it to the guard.

Administrators can access any existing project. Partners can only access projects assigned to their organization.

## 3. UI Route Protection

Use the named Nuxt middleware to restrict administrator-only pages.

Add this inside the page's `<script setup>` block:

```ts
definePageMeta({
  middleware: 'npts',
})
```

The middleware checks the current user's administrator status using `/api/me` and redirects unauthorized users to `/`.

**Important:** UI middleware improves navigation and user experience, but backend authorization guards must still protect sensitive API operations.

## 4. HTTP Status Codes

| Status           | Meaning                                         |
| ---------------- | ----------------------------------------------- |
| 401 Unauthorized | The user is not authenticated.                  |
| 403 Forbidden    | The user is authenticated but lacks permission. |
| 404 Not Found    | The requested project does not exist.           |

## 5. Implementation Files

- `server/utils/authorization.ts` — Reusable server authorization guards.
- `server/utils/session.ts` — Authentication helper.
- `server/api/me.get.ts` — Current user's administrator status.
- `app/middleware/npts.ts` — Named UI route middleware.
