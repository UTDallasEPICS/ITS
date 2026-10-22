<script setup lang="ts">
  import type { TicketSummary } from '../types/ticket'
  defineProps<{ tickets: TicketSummary[] }>()
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-left">
      <caption class="sr-only">
        Accessible project tickets, newest first
      </caption>
      <thead>
        <tr class="border-default border-b">
          <th scope="col" class="p-3">Ticket</th>
          <th scope="col" class="p-3">Project</th>
          <th scope="col" class="p-3">Status</th>
          <th scope="col" class="p-3">Created (UTC)</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ticket in tickets" :key="ticket.id" class="border-default border-b">
          <td class="p-3">
            <NuxtLink :to="`/tickets/${ticket.id}`" class="text-primary break-words underline"
              >#{{ ticket.id }} — {{ ticket.title }}</NuxtLink
            >
          </td>
          <td class="p-3">{{ ticket.projectName }}</td>
          <td class="p-3"><TicketStatusBadge :status="ticket.status" /></td>
          <td class="p-3">
            <time :datetime="ticket.timestamp">{{
              ticket.timestamp.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
            }}</time>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
