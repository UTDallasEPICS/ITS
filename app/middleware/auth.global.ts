import { authClient } from '../utils/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.dev && to.path === '/dev/chat') return

  const { data: session } = await authClient.useSession(useFetch)

  if (session.value) {
    if (to.path === '/auth') {
      return navigateTo('/')
    }
  } else {
    if (to.path !== '/auth') {
      return navigateTo('/auth')
    }
  }
})
