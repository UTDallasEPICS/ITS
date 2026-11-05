<script setup lang="ts">
  defineProps<{ status: string }>()
</script>

<template>
  <!-- Status is currently free text in the shared schema; preserve unfamiliar values. -->
  <UBadge color="neutral" variant="subtle">{{ status }}</UBadge>
</template>
