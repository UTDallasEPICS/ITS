<script setup lang="ts">
  import type { TicketSummary } from '../../types/ticket'

  const { data: tickets, status, error, refresh } = await useFetch<TicketSummary[]>('/api/tickets')
  const selectedProject = ref('all')
  const selectedStatus = ref('all')
  const projects = computed(() => [
    { label: 'All projects', value: 'all' },
    ...Array.from(
      new Map((tickets.value ?? []).map((ticket) => [ticket.projectId, ticket.projectName]))
    )
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ label: name, value: String(id) })),
  ])
  const statuses = computed(() => [
    { label: 'All statuses', value: 'all' },
    ...Array.from(new Set((tickets.value ?? []).map((ticket) => ticket.status)))
      .sort()
      .map((value) => ({ label: value, value })),
  ])
  const filteredTickets = computed(() =>
    (tickets.value ?? []).filter(
      (ticket) =>
        (selectedProject.value === 'all' || String(ticket.projectId) === selectedProject.value) &&
        (selectedStatus.value === 'all' || ticket.status === selectedStatus.value)
    )
  )

  function clearFilters() {
    selectedProject.value = 'all'
    selectedStatus.value = 'all'
  }
</script>

<template>
  <UContainer class="py-10">
    <UButton to="/" variant="link" class="mb-4">Back to dashboard</UButton>
    <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold">Tickets</h1>
        <p class="text-muted mt-2">Follow tickets for the projects you can access.</p>
      </div>
      <div class="flex gap-3">
        <UButton variant="outline" :disabled="status === 'pending'" @click="refresh()"
          >Refresh</UButton
        >
        <UButton to="/tickets/new">New ticket</UButton>
      </div>
    </div>
    <p v-if="status === 'pending' || status === 'idle'" role="status">Loading tickets…</p>
    <TicketLoadError v-else-if="error" :status-code="error.statusCode" @retry="refresh()" />
    <div v-else-if="!tickets?.length" role="status" class="py-8">
      No tickets yet. Submit a ticket for one of your projects to get started.
    </div>
    <div v-else class="space-y-5">
      <div class="flex flex-wrap items-end gap-4">
        <UFormField label="Project"
          ><USelect v-model="selectedProject" :items="projects" class="min-w-48"
        /></UFormField>
        <UFormField label="Status"
          ><USelect v-model="selectedStatus" :items="statuses" class="min-w-40"
        /></UFormField>
        <UButton variant="ghost" @click="clearFilters">Clear filters</UButton>
      </div>
      <TicketList v-if="filteredTickets.length" :tickets="filteredTickets" />
      <p v-else role="status">No tickets match these filters.</p>
    </div>
  </UContainer>
</template>
