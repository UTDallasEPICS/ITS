<script setup lang="ts">
  definePageMeta({
    middleware: 'npts',
  })

  // Existing code below
  const { data: users, pending, error, refresh } = await useFetch('/api/users')
  const { data: organizations } = await useFetch('/api/organizations')

  const archivingUserId = ref<string | null>(null)
  const showAddUserForm = ref(false)
  const creatingUser = ref(false)

  const newUser = reactive({
    name: '',
    email: '',
    orgId: '',
  })

  const isNewNptsUser = computed(() => newUser.email.trim().toLowerCase().endsWith('@npts.tech'))

  async function createUser() {
    try {
      creatingUser.value = true

      await $fetch('/api/users', {
        method: 'POST',
        body: {
          name: newUser.name,
          email: newUser.email,
          orgId: newUser.orgId,
        },
      })

      await refresh()

      newUser.name = ''
      newUser.email = ''
      newUser.orgId = ''
      showAddUserForm.value = false

      window.alert('User created successfully!')
    } catch (error) {
      console.error('Failed to create user:', error)
      window.alert('Failed to create user. Check the input values.')
    } finally {
      creatingUser.value = false
    }
  }

  async function archiveUser(userId: string, email: string) {
    const confirmed = window.confirm(`Are you sure you want to archive ${email}?`)

    if (!confirmed) return

    try {
      archivingUserId.value = userId

      await $fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })

      await refresh()
    } catch (error) {
      console.error('Failed to archive user:', error)
      window.alert('Failed to archive user. Please try again.')
    } finally {
      archivingUserId.value = null
    }
  }

  const editingUserId = ref<string | null>(null)
  const selectedOrgId = ref('')
  const updatingOrg = ref(false)

  function startEditingOrg(userId: string, orgId: string | null) {
    editingUserId.value = userId
    selectedOrgId.value = orgId ?? ''
  }

  function cancelEditingOrg() {
    editingUserId.value = null
    selectedOrgId.value = ''
  }

  async function updateUserOrg(userId: string) {
    if (!selectedOrgId.value.trim()) {
      window.alert('Please enter a valid Organization.')
      return
    }

    try {
      updatingOrg.value = true

      await $fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: {
          orgId: selectedOrgId.value,
        },
      })

      await refresh()
      cancelEditingOrg()

      window.alert('User organization updated successfully!')
    } catch (error) {
      console.error('Failed to update user organization:', error)
      window.alert('Failed to update user organization.')
    } finally {
      updatingOrg.value = false
    }
  }
</script>

<template>
  <main class="min-h-screen bg-slate-900 px-3 py-6 text-slate-50 sm:px-6 sm:py-12">
    <div class="mx-auto max-w-[1200px]">
      <header class="mb-8">
        <div>
          <p class="mb-3 text-xs font-bold tracking-[2px] text-blue-400">ADMIN DASHBOARD</p>

          <h1 class="mb-2 text-3xl font-bold">User Management</h1>

          <p class="text-[15px] text-slate-400">Manage users, organizations, and account access.</p>
        </div>
      </header>

      <section class="overflow-hidden rounded-[14px] border border-slate-700 bg-slate-800">
        <div
          class="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center"
        >
          <div>
            <h2 class="mb-1.5 text-lg font-semibold">Registered Users</h2>
            <p class="text-[13px] text-slate-400">View and manage registered accounts.</p>
          </div>

          <div class="flex items-center gap-3">
            <span
              class="rounded-full bg-slate-700 px-3 py-1.5 text-xs whitespace-nowrap text-slate-300"
            >
              {{ users?.length ?? 0 }} users
            </span>

            <button
              type="button"
              class="rounded-lg bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
              @click="showAddUserForm = !showAddUserForm"
            >
              {{ showAddUserForm ? 'Cancel' : '+ Add User' }}
            </button>
          </div>
        </div>
        <form
          v-if="showAddUserForm"
          class="flex flex-wrap gap-3 border-t border-slate-700 px-6 py-5"
          @submit.prevent="createUser"
        >
          <input
            v-model="newUser.name"
            type="text"
            placeholder="Full name"
            class="min-w-0 flex-[1_1_180px] rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-slate-50 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
            required
          />

          <input
            v-model="newUser.email"
            type="email"
            placeholder="Email address"
            class="min-w-0 flex-[1_1_180px] rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-slate-50 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
            required
          />

          <p v-if="isNewNptsUser" class="w-full text-xs text-blue-300">
            NPTS email detected — this account will be created as an administrator.
          </p>

          <select
            v-if="!isNewNptsUser"
            v-model="newUser.orgId"
            class="min-w-0 flex-[1_1_180px] rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-slate-50 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
            required
          >
            <option value="" disabled>Select organization</option>
            <option v-for="org in organizations ?? []" :key="org.id" :value="org.id">
              {{ org.name }}
            </option>
          </select>

          <button
            type="submit"
            class="rounded-lg bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
            :disabled="creatingUser"
          >
            {{ creatingUser ? 'Creating...' : 'Create User' }}
          </button>
        </form>

        <p v-if="pending" class="p-6 text-slate-400">Loading users...</p>

        <p v-else-if="error" class="p-6 text-red-300">Failed to load users.</p>

        <div v-else class="overflow-x-auto">
          <table class="w-full border-collapse text-left">
            <thead class="bg-[#172235]">
              <tr>
                <th
                  class="px-6 py-4 text-xs font-semibold tracking-wide text-slate-400 uppercase max-sm:px-3"
                >
                  Name
                </th>
                <th
                  class="px-6 py-4 text-xs font-semibold tracking-wide text-slate-400 uppercase max-sm:px-3"
                >
                  Email
                </th>
                <th
                  class="px-6 py-4 text-xs font-semibold tracking-wide text-slate-400 uppercase max-sm:px-3"
                >
                  Organization
                </th>
                <th
                  class="px-6 py-4 text-xs font-semibold tracking-wide text-slate-400 uppercase max-sm:px-3"
                >
                  Status
                </th>
                <th
                  class="px-6 py-4 text-xs font-semibold tracking-wide text-slate-400 uppercase max-sm:px-3"
                >
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="user in users" :key="user.id" class="hover:bg-[#263449]">
                <td
                  class="border-t border-slate-700 px-6 py-[18px] text-sm font-semibold whitespace-nowrap max-sm:px-3 max-sm:py-3.5"
                >
                  {{ user.name || 'Unnamed User' }}
                </td>

                <td
                  class="border-t border-slate-700 px-6 py-[18px] text-sm text-slate-300 max-sm:px-3 max-sm:py-3.5"
                >
                  {{ user.email }}
                </td>

                <td
                  class="border-t border-slate-700 px-6 py-[18px] text-sm max-sm:px-3 max-sm:py-3.5"
                >
                  <div v-if="editingUserId === user.id" class="flex items-center gap-2">
                    <select
                      v-model="selectedOrgId"
                      class="w-[180px] rounded-md border border-slate-600 bg-slate-900 px-2.5 py-2 text-[13px] text-slate-50 disabled:opacity-50"
                      :disabled="updatingOrg"
                    >
                      <option value="" disabled>Select organization</option>
                      <option v-for="org in organizations ?? []" :key="org.id" :value="org.id">
                        {{ org.name }}
                      </option>
                    </select>
                    <button
                      class="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="updatingOrg"
                      @click="updateUserOrg(user.id)"
                    >
                      {{ updatingOrg ? 'Saving...' : 'Save' }}
                    </button>

                    <button
                      class="rounded-md bg-slate-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="updatingOrg"
                      @click="cancelEditingOrg"
                    >
                      Cancel
                    </button>
                  </div>

                  <div v-else class="flex items-center gap-3">
                    <span class="text-slate-300">
                      {{
                        user.orgId === null
                          ? 'Admin'
                          : (organizations?.find((org) => org.id === user.orgId)?.name ?? 'Partner')
                      }}
                    </span>

                    <button
                      v-if="user.orgId !== null && !user.isArchived"
                      class="rounded-md bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
                      :disabled="editingUserId !== null"
                      @click="startEditingOrg(user.id, user.orgId)"
                    >
                      Edit
                    </button>
                  </div>
                </td>

                <td
                  class="border-t border-slate-700 px-6 py-[18px] text-sm max-sm:px-3 max-sm:py-3.5"
                >
                  <span
                    class="inline-flex items-center gap-[7px] rounded-full px-2.5 py-1.5 text-xs font-semibold"
                    :class="
                      user.isArchived
                        ? 'bg-slate-600 text-slate-300'
                        : 'bg-[#14532d55] text-green-300'
                    "
                  >
                    <span class="h-[7px] w-[7px] rounded-full bg-current"></span>
                    {{ user.isArchived ? 'Archived' : 'Active' }}
                  </span>
                </td>

                <td
                  class="border-t border-slate-700 px-6 py-[18px] text-sm max-sm:px-3 max-sm:py-3.5"
                >
                  <button
                    v-if="user.orgId !== null"
                    class="rounded-lg bg-blue-600 px-4 py-[9px] text-[13px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
                    :disabled="user.isArchived || archivingUserId !== null"
                    @click="archiveUser(user.id, user.email)"
                  >
                    {{
                      archivingUserId === user.id
                        ? 'Archiving...'
                        : user.isArchived
                          ? 'Archived'
                          : 'Archive'
                    }}
                  </button>

                  <span v-else class="text-slate-500">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>
</template>
