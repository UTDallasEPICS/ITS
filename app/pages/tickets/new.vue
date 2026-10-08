<script setup lang="ts">
  import type { TicketFormValues, TicketProjectOption } from '../../types/ticket'

  const {
    data: projects,
    status,
    error,
    refresh,
  } = await useFetch<TicketProjectOption[]>('/api/projects')

  const submitting = ref(false)
  const submitError = ref('')
  const createdTicket = ref<{ id: number; status: string } | null>(null)

  const projectErrorMessage = computed(() => {
    if (error.value?.statusCode === 403) {
      return 'Your account needs a partner organization. Contact your NPTS team for access.'
    }
    if (error.value?.statusCode === 401) {
      return 'Your session has expired. Sign in again to load your projects.'
    }
    return 'We could not load your projects. Please try again.'
  })

  async function submitTicket(values: TicketFormValues) {
    if (submitting.value || createdTicket.value) return

    submitting.value = true
    submitError.value = ''

    try {
      const ticket = await $fetch('/api/tickets', { method: 'POST', body: values })
      createdTicket.value = { id: ticket.id, status: ticket.status }
    } catch {
      submitError.value =
        'We could not submit your ticket. Your draft is still here. Please try again.'
    } finally {
      submitting.value = false
    }
  }
</script>

<template>
  <UContainer class="max-w-2xl py-10">
    <UButton to="/" variant="link" class="mb-4">Back to dashboard</UButton>

    <h1 class="text-3xl font-bold">New ticket</h1>
    <p class="text-muted mt-2 mb-8">
      Choose your project and describe the issue you need help with.
    </p>

    <p v-if="status === 'pending' || status === 'idle'" role="status">Loading your projects…</p>

    <div v-else-if="error" class="space-y-4">
      <UAlert
        role="alert"
        color="error"
        title="Unable to load projects"
        :description="projectErrorMessage"
      />
      <UButton v-if="error.statusCode === 401" to="/auth">Sign in</UButton>
      <UButton v-else @click="refresh()">Try again</UButton>
    </div>

    <div v-else-if="createdTicket" class="space-y-4">
      <UAlert
        role="status"
        color="success"
        title="Ticket submitted"
        :description="`Ticket #${createdTicket.id} was saved. Status: ${createdTicket.status}.`"
      />
      <UButton @click="createdTicket = null">Submit another ticket</UButton>
    </div>

    <div v-else class="space-y-4">
      <UAlert
        v-if="submitError"
        role="alert"
        color="error"
        title="Unable to submit ticket"
        :description="submitError"
      />
      <UCard>
        <TicketForm :projects="projects ?? []" :submitting="submitting" @submit="submitTicket" />
      </UCard>
    </div>
  </UContainer>
</template>
