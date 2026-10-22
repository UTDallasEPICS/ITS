<script setup lang="ts">
  const props = defineProps<{ statusCode?: number }>()
  defineEmits<{ retry: [] }>()
  const message = computed(() => {
    if (props.statusCode === 401) return 'Your session has expired. Sign in again.'
    if (props.statusCode === 403)
      return 'Your account access is unavailable. Contact your NPTS team.'
    if (props.statusCode === 404)
      return 'This ticket does not exist or is not available to your account.'
    return 'We could not load tickets. Please try again.'
  })
</script>

<template>
  <div class="space-y-4">
    <UAlert
      role="alert"
      color="error"
      :title="statusCode === 404 ? 'Ticket not found' : 'Unable to load tickets'"
      :description="message"
    />
    <UButton v-if="statusCode === 401" to="/auth">Sign in</UButton>
    <UButton v-else-if="statusCode !== 404" @click="$emit('retry')">Try again</UButton>
  </div>
</template>
