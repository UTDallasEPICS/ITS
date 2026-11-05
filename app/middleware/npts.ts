export default defineNuxtRouteMiddleware(async () => {
  const { checkAdmin } = useNptsAccess()

  const isAdmin = await checkAdmin()

  if (!isAdmin) {
    return navigateTo('/')
  }
})
