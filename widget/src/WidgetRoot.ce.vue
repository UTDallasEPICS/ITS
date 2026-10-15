<script setup lang="ts">
  import { ref } from 'vue'

  // Values passed in from main.ts (site-tag="..." becomes siteTag)
  const props = defineProps<{ siteTag: string; apiBase: string }>()

  const open = ref(false)
  const status = ref('Not checked yet')

  // Same request as widget-test.js, now inside Vue
  async function checkConnection() {
    status.value = 'Connecting...'
    try {
      const res = await fetch(`${props.apiBase}/api/health?siteTag=${props.siteTag}`)
      const data = await res.json()
      status.value = `Connected to ITS (site tag: ${props.siteTag}, time: ${data.timestamp})`
    } catch (err) {
      status.value = `Connection failed: ${String(err)}`
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
      <p class="status">{{ status }}</p>
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
