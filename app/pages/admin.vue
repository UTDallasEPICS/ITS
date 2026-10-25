<script setup lang="ts">
  const { data: users, pending, error, refresh } = await useFetch('/api/users')

  const archivingUserId = ref<string | null>(null)
  const showAddUserForm = ref(false)
  const creatingUser = ref(false)

  const newUser = reactive({
    name: '',
    email: '',
    orgId: '',
  })

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
  const updatingRole = ref(false)

  function startEditingRole(userId: string, orgId: string | null) {
    editingUserId.value = userId
    selectedOrgId.value = orgId ?? ''
  }

  function cancelEditingRole() {
    editingUserId.value = null
    selectedOrgId.value = ''
  }

  async function updateUserRole(userId: string) {
    if (!selectedOrgId.value.trim()) {
      window.alert('Please enter a valid Organization ID.')
      return
    }

    try {
      updatingRole.value = true

      await $fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        body: {
          orgId: selectedOrgId.value.trim(),
        },
      })

      await refresh()
      cancelEditingRole()

      window.alert('User role updated successfully!')
    } catch (error) {
      console.error('Failed to update user role:', error)
      window.alert('Failed to update user role.')
    } finally {
      updatingRole.value = false
    }
  }
</script>

<template>
  <main class="admin-page">
    <div class="dashboard">
      <header class="page-header">
        <div>
          <p class="eyebrow">ADMIN DASHBOARD</p>
          <h1>User Management</h1>
          <p class="subtitle">Manage users, roles, and account access.</p>
        </div>
      </header>

      <section class="users-card">
        <div class="card-header">
          <div>
            <h2>Registered Users</h2>
            <p>View and manage registered accounts.</p>
          </div>

          <div class="header-actions">
            <span class="user-count"> {{ users?.length ?? 0 }} users </span>

            <button type="button" class="add-button" @click="showAddUserForm = !showAddUserForm">
              {{ showAddUserForm ? 'Cancel' : '+ Add User' }}
            </button>
          </div>
        </div>

        <form v-if="showAddUserForm" class="add-user-form" @submit.prevent="createUser">
          <input v-model="newUser.name" type="text" placeholder="Full name" required />

          <input v-model="newUser.email" type="email" placeholder="Email address" required />

          <input v-model="newUser.orgId" type="text" placeholder="Organization ID" required />

          <button type="submit" class="add-button" :disabled="creatingUser">
            {{ creatingUser ? 'Creating...' : 'Create User' }}
          </button>
        </form>

        <p v-if="pending" class="message">Loading users...</p>

        <p v-else-if="error" class="message error">Failed to load users.</p>

        <div v-else class="table-container">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="user in users" :key="user.id">
                <td class="name-cell">
                  {{ user.name || 'Unnamed User' }}
                </td>

                <td class="email-cell">
                  {{ user.email }}
                </td>

                <td>
                  <div v-if="editingUserId === user.id" class="role-editor">
                    <input
                      v-model="selectedOrgId"
                      type="text"
                      placeholder="Organization ID"
                      class="role-input"
                      :disabled="updatingRole"
                    />

                    <button
                      class="save-role-button"
                      :disabled="updatingRole"
                      @click="updateUserRole(user.id)"
                    >
                      {{ updatingRole ? 'Saving...' : 'Save' }}
                    </button>

                    <button
                      class="cancel-role-button"
                      :disabled="updatingRole"
                      @click="cancelEditingRole"
                    >
                      Cancel
                    </button>
                  </div>

                  <div v-else class="role-display">
                    <span class="role-label">
                      {{ user.orgId === null ? 'Admin' : 'Partner' }}
                    </span>

                    <button
                      v-if="user.orgId !== null && !user.isArchived"
                      class="edit-role-button"
                      :disabled="editingUserId !== null"
                      @click="startEditingRole(user.id, user.orgId)"
                    >
                      Edit
                    </button>
                  </div>
                </td>

                <td>
                  <span class="status-badge" :class="user.isArchived ? 'archived' : 'active'">
                    <span class="status-dot"></span>
                    {{ user.isArchived ? 'Archived' : 'Active' }}
                  </span>
                </td>

                <td>
                  <button
                    v-if="user.orgId !== null"
                    class="archive-button"
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

                  <span v-else class="no-action">—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
  .admin-page {
    min-height: 100vh;
    background: #0f172a;
    color: #f8fafc;
    padding: 48px 24px;
  }

  .dashboard {
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: 32px;
  }

  .eyebrow {
    color: #60a5fa;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 2px;
    margin-bottom: 12px;
  }

  h1 {
    font-size: 32px;
    font-weight: 700;
    margin: 0 0 8px;
  }

  .subtitle {
    color: #94a3b8;
    font-size: 15px;
  }

  .users-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 14px;
    overflow: hidden;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 24px;
    gap: 16px;
  }

  .card-header h2 {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 6px;
  }

  .card-header p {
    color: #94a3b8;
    font-size: 13px;
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .user-count {
    color: #cbd5e1;
    background: #334155;
    border-radius: 20px;
    padding: 6px 12px;
    font-size: 12px;
    white-space: nowrap;
  }

  .add-button {
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 7px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .add-button:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .add-button:disabled {
    background: #475569;
    color: #94a3b8;
    cursor: not-allowed;
  }

  .add-user-form {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 20px 24px;
    border-top: 1px solid #334155;
  }

  .add-user-form input {
    flex: 1 1 180px;
    min-width: 0;
    background: #0f172a;
    border: 1px solid #475569;
    border-radius: 7px;
    padding: 10px 12px;
    color: #f8fafc;
  }

  .add-user-form input::placeholder {
    color: #94a3b8;
  }

  .add-user-form input:focus {
    outline: none;
    border-color: #60a5fa;
  }

  .table-container {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
  }

  thead {
    background: #172235;
  }

  th {
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 16px 24px;
  }

  td {
    padding: 18px 24px;
    border-top: 1px solid #334155;
    font-size: 14px;
  }

  tbody tr:hover {
    background: #263449;
  }

  .name-cell {
    font-weight: 600;
    white-space: nowrap;
  }

  .email-cell {
    color: #cbd5e1;
  }

  .role-label {
    color: #cbd5e1;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 10px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }

  .status-badge.active {
    color: #86efac;
    background: #14532d55;
  }

  .status-badge.archived {
    color: #cbd5e1;
    background: #475569;
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }

  .archive-button {
    background: #2563eb;
    color: white;
    border: none;
    border-radius: 7px;
    padding: 9px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .archive-button:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .archive-button:disabled {
    background: #475569;
    color: #94a3b8;
    cursor: not-allowed;
  }

  .no-action {
    color: #64748b;
  }

  .message {
    padding: 24px;
    color: #94a3b8;
  }

  .message.error {
    color: #fca5a5;
  }

  @media (max-width: 640px) {
    .admin-page {
      padding: 24px 12px;
    }

    .card-header {
      align-items: flex-start;
      flex-direction: column;
    }

    th,
    td {
      padding: 14px 12px;
    }
  }

  .role-display {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .role-editor {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .role-input {
    width: 180px;
    padding: 8px 10px;
    background: #0f172a;
    border: 1px solid #475569;
    border-radius: 6px;
    color: #f8fafc;
    font-size: 13px;
  }

  .edit-role-button,
  .save-role-button,
  .cancel-role-button {
    border: none;
    border-radius: 6px;
    padding: 7px 12px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .edit-role-button {
    background: #334155;
    color: #e2e8f0;
  }

  .save-role-button {
    background: #2563eb;
    color: white;
  }

  .cancel-role-button {
    background: #475569;
    color: white;
  }

  .edit-role-button:hover:not(:disabled) {
    background: #475569;
  }

  .save-role-button:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .edit-role-button:disabled,
  .save-role-button:disabled,
  .cancel-role-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
