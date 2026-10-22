<script setup lang="ts">
  import { MOCK_TICKETS } from '../../utils/tickets'

  definePageMeta({
    auth: false,
  })

  useHead({
    title: 'NPTS Tickets - Issue Tracking System',
  })

  // Group tickets or filter duplicates (e.g. ticket #1 and #46)
  const ticketsList = computed(() => {
    return MOCK_TICKETS
  })

  function getStatusColor(status: string) {
    switch (status.toLowerCase()) {
      case 'open':
        return 'info'
      case 'in progress':
      case 'in-progress':
        return 'warning'
      case 'closed':
      case 'resolved':
        return 'success'
      default:
        return 'neutral'
    }
  }
</script>

<template>
  <UContainer class="max-w-5xl py-10">
    <div class="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Tickets</h1>
        <p class="mt-1 text-gray-500 dark:text-gray-400">
          NPTS Issue Tracking System ticket backlog and active issues.
        </p>
      </div>

      <UButton
        to="/"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-arrow-left-20-solid"
        label="Home Dashboard"
      />
    </div>

    <UCard class="w-full">
      <template #header>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-ticket-20-solid" class="h-5 w-5 text-gray-500" />
            <h2 class="text-base font-semibold text-gray-900 dark:text-white">Active Tickets</h2>
          </div>
          <UBadge variant="subtle" color="primary" size="md">
            {{ ticketsList.length }} Tickets
          </UBadge>
        </div>
      </template>

      <div class="divide-y divide-gray-200 dark:divide-gray-800">
        <NuxtLink
          v-for="t in ticketsList"
          :key="t.id"
          :to="`/tickets/${t.id}`"
          class="flex flex-col gap-2 rounded-lg px-2 py-4 transition-colors hover:bg-gray-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-gray-800/50"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-primary-500 font-mono text-xs font-semibold">#{{ t.id }}</span>
              <span class="font-medium text-gray-900 dark:text-white">{{ t.title }}</span>
            </div>
            <p class="line-clamp-1 max-w-xl text-xs text-gray-500 dark:text-gray-400">
              {{ t.description }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <UBadge :color="getStatusColor(t.status)" variant="subtle" size="sm">
              {{ t.status }}
            </UBadge>
            <UIcon name="i-heroicons-chevron-right-20-solid" class="h-4 w-4 text-gray-400" />
          </div>
        </NuxtLink>
      </div>
    </UCard>
  </UContainer>
</template>
