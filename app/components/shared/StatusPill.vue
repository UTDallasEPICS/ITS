<script setup lang="ts">
  // Shared between the ITS app and the embeddable widget (widget/).
  // Rules for shared components: import everything explicitly (no Nuxt
  // auto-imports, no Nuxt UI / Tailwind classes) so they also build outside Nuxt.
  import { computed } from 'vue'

  const props = defineProps<{ state: 'idle' | 'loading' | 'ok' | 'error' }>()

  const label = computed(
    () =>
      ({
        idle: 'Not checked',
        loading: 'Connecting…',
        ok: 'Connected to ITS',
        error: 'Connection failed',
      })[props.state]
  )
</script>

<template>
  <span class="status-pill" :data-state="state">{{ label }}</span>
</template>

<style>
  .status-pill {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    background: #e5e7eb;
    color: #374151;
  }
  .status-pill[data-state='ok'] {
    background: #dcfce7;
    color: #166534;
  }
  .status-pill[data-state='error'] {
    background: #fee2e2;
    color: #991b1b;
  }
</style>
