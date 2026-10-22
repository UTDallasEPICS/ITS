<script setup lang="ts">
  import { ref } from 'vue'
  // Shared component that lives in the main ITS app (app/components/shared).
  // Importing it here proves UI code can be reused in the widget.
  import StatusPill from '../../app/components/shared/StatusPill.vue'

  // Values passed in from main.ts (site-tag="..." becomes siteTag)
  const props = defineProps<{ siteTag: string; apiBase: string }>()

  const open = ref(false)
  const state = ref<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const detail = ref('')

  // Same request as before, now drives the shared StatusPill
  async function checkConnection() {
    state.value = 'loading'
    detail.value = ''
    try {
      const res = await fetch(`${props.apiBase}/api/health?siteTag=${props.siteTag}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      state.value = 'ok'
      detail.value = `site tag: ${props.siteTag}, time: ${data.timestamp}`
    } catch (err) {
      state.value = 'error'
      detail.value = String(err)
    }
  }

  function toggle() {
    open.value = !open.value
    if (open.value) checkConnection()
  }
</script>

<template>
  <div class="root">
    <div v-if="open" class="panel">
      <div class="panel-header">
        <strong>Report an issue</strong>
        <button class="close" @click="open = false">×</button>
      </div>
      <StatusPill :state="state" />
      <p class="status">{{ detail }}</p>
      <!-- #20: the shared ticket form goes here -->
    </div>
    <button class="launcher" @click="toggle">?</button>
  </div>
</template>

<style>
  :host {
    all: initial; /* don't inherit fonts/colors from the host page */
  }
  .root {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    font-family: system-ui, sans-serif;
  }
  .launcher {
    width: 56px;
    height: 56px;
    border: none;
    border-radius: 50%;
    background: #2563eb;
    color: white;
    font-size: 24px;
    cursor: pointer;
  }
  .panel {
    width: 300px;
    padding: 16px;
    background: white;
    color: #111827;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgb(0 0 0 / 0.18);
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .close {
    border: none;
    background: none;
    font-size: 20px;
    cursor: pointer;
  }
  .status {
    font-size: 13px;
    color: #4b5563;
  }
</style>
