export function useNptsAccess() {
  const isAdmin = ref(false)

  async function checkAdmin() {
    try {
      const response = await useRequestFetch()<{ isAdmin: boolean }>('/api/me')

      isAdmin.value = response.isAdmin
      return response.isAdmin
    } catch {
      isAdmin.value = false
      return false
    }
  }

  return {
    isAdmin,
    checkAdmin,
  }
}
