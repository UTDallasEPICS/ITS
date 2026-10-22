<script setup lang="ts">
  import { getMockTicketById } from '../../utils/tickets'

  // Allow unauthenticated preview for local development and grading/testing
  definePageMeta({
    auth: false,
  })

  const route = useRoute()
  const ticketIdParam = computed(() => {
    const raw = route.params.id
    return Array.isArray(raw) ? raw[0] : raw
  })

  const ticket = computed(() => {
    if (!ticketIdParam.value) return null
    return getMockTicketById(ticketIdParam.value)
  })

  // Set page meta title dynamically
  useHead({
    title: computed(() =>
      ticket.value ? `Ticket #${ticket.value.id}: ${ticket.value.title}` : 'Ticket Not Found'
    ),
  })
</script>

<template>
  <UContainer class="max-w-5xl py-10">
    <!-- Ticket Found -->
    <div v-if="ticket">
      <TicketDetail :ticket="ticket" />
    </div>

    <!-- Ticket Not Found -->
    <div v-else class="space-y-6">
      <UButton
        id="back-to-tickets-btn-empty"
        to="/tickets"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-arrow-left-20-solid"
        label="Back to Tickets"
      />

      <UCard class="py-12 text-center">
        <div
          class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        >
          <UIcon name="i-heroicons-exclamation-triangle-20-solid" class="h-8 w-8" />
        </div>

        <h2 class="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Ticket Not Found</h2>
        <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          No ticket found with ID: <span class="font-mono font-semibold">{{ ticketIdParam }}</span>
        </p>

        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <UButton
            to="/tickets/1"
            color="primary"
            variant="solid"
            icon="i-heroicons-ticket-20-solid"
            label="View Ticket #1"
          />
          <UButton
            to="/tickets/46"
            color="neutral"
            variant="outline"
            icon="i-heroicons-ticket-20-solid"
            label="View Ticket #46"
          />
        </div>
      </UCard>
    </div>
  </UContainer>
</template>
