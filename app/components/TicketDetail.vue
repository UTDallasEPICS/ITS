<script setup lang="ts">
  import type { Ticket } from '../utils/tickets'

  interface Props {
    ticket: Ticket
  }

  const props = defineProps<Props>()

  const toast = useToast()

  // Format the database schema's `timestamp` text column into a human-readable date
  const formattedDate = computed(() => {
    if (!props.ticket.timestamp) return 'N/A'
    try {
      const parsed = new Date(props.ticket.timestamp)
      if (isNaN(parsed.getTime())) return props.ticket.timestamp
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(parsed)
    } catch {
      return props.ticket.timestamp
    }
  })

  // Color mapping for ticket status badge in Nuxt UI
  const statusColor = computed(() => {
    switch (props.ticket.status.toLowerCase()) {
      case 'open':
        return 'info'
      case 'in progress':
      case 'in-progress':
        return 'warning'
      case 'closed':
      case 'resolved':
      case 'completed':
        return 'success'
      case 'blocked':
        return 'error'
      default:
        return 'neutral'
    }
  })

  async function copyTicketLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast.add({
        title: 'Link Copied',
        description: `URL for ticket #${props.ticket.id} copied to clipboard.`,
        color: 'success',
      })
    } catch {
      toast.add({
        title: 'Copy Failed',
        description: 'Could not copy link to clipboard.',
        color: 'error',
      })
    }
  }
</script>

<template>
  <div class="space-y-6">
    <!-- Top Action / Navigation Bar -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <UButton
        id="back-to-tickets-btn"
        to="/tickets"
        variant="ghost"
        color="neutral"
        icon="i-heroicons-arrow-left-20-solid"
        label="Back to Tickets"
      />

      <div class="flex items-center gap-2">
        <UButton
          id="copy-ticket-link-btn"
          variant="outline"
          color="neutral"
          icon="i-heroicons-share-20-solid"
          size="sm"
          label="Share Link"
          @click="copyTicketLink"
        />

        <UButton
          v-if="ticket.githubIssueId"
          id="github-issue-link-btn"
          :to="`https://github.com/UTDallasEPICS/ITS/issues/${ticket.githubIssueId}`"
          target="_blank"
          variant="outline"
          color="neutral"
          icon="i-heroicons-arrow-top-right-on-square-20-solid"
          size="sm"
          :label="`GitHub #${ticket.githubIssueId}`"
        />
      </div>
    </div>

    <!-- Main Detail Card -->
    <UCard id="ticket-detail-card" class="w-full shadow-sm">
      <template #header>
        <div class="space-y-3">
          <!-- Meta tags row -->
          <div class="flex flex-wrap items-center gap-2">
            <UBadge color="neutral" variant="outline" size="md">
              <UIcon name="i-heroicons-hashtag-20-solid" class="mr-1 h-3.5 w-3.5" />
              Ticket #{{ ticket.id }}
            </UBadge>

            <UBadge :color="statusColor" variant="subtle" size="md">
              <span class="mr-1.5 h-2 w-2 rounded-full bg-current"></span>
              {{ ticket.status }}
            </UBadge>

            <UBadge color="neutral" variant="subtle" size="md">
              <UIcon name="i-heroicons-folder-20-solid" class="mr-1 h-3.5 w-3.5" />
              Project #{{ ticket.projectId }}
            </UBadge>
          </div>

          <!-- Title -->
          <h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            {{ ticket.title }}
          </h1>

          <!-- Date Created / Timestamp row -->
          <div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <UIcon name="i-heroicons-calendar-days-20-solid" class="h-4 w-4" />
            <span
              >Date Created:
              <strong class="font-medium text-gray-700 dark:text-gray-300">{{
                formattedDate
              }}</strong></span
            >
            <span class="font-mono text-xs text-gray-400 dark:text-gray-500"
              >({{ ticket.timestamp }})</span
            >
          </div>
        </div>
      </template>

      <!-- Ticket Core Description -->
      <div class="space-y-6">
        <div>
          <h2
            class="text-sm font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
          >
            Description
          </h2>
          <div
            id="ticket-description"
            class="mt-2 rounded-lg bg-gray-50 p-4 text-base leading-relaxed text-gray-800 dark:bg-gray-800/50 dark:text-gray-200"
          >
            {{ ticket.description }}
          </div>
        </div>

        <!-- Schema Field Breakdown Table / Grid -->
        <div class="border-t border-gray-200 pt-6 dark:border-gray-800">
          <h2
            class="mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
          >
            Database Properties (server/db/schema.ts)
          </h2>

          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Ticket ID (`id`)</dt>
              <dd class="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                {{ ticket.id }}
              </dd>
            </div>

            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">Title (`title`)</dt>
              <dd class="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
                {{ ticket.title }}
              </dd>
            </div>

            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                Status (`status`)
              </dt>
              <dd class="mt-1 text-sm font-semibold">
                <UBadge :color="statusColor" variant="subtle" size="sm">{{ ticket.status }}</UBadge>
              </dd>
            </div>

            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                Date Created (`timestamp`)
              </dt>
              <dd class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {{ ticket.timestamp }}
              </dd>
            </div>

            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                Project ID (`projectId`)
              </dt>
              <dd class="mt-1 text-base font-semibold text-gray-900 dark:text-white">
                {{ ticket.projectId }}
              </dd>
            </div>

            <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
              <dt class="text-xs font-medium text-gray-500 dark:text-gray-400">
                Assigned User (`userId`)
              </dt>
              <dd class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {{ ticket.userId ?? 'None' }}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Schema Model: <code class="text-primary-500 font-mono">tickets</code> table</span>
          <NuxtLink to="/tickets" class="text-primary-500 font-medium hover:underline">
            &larr; Return to ticket index
          </NuxtLink>
        </div>
      </template>
    </UCard>
  </div>
</template>
