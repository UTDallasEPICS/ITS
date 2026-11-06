<script setup lang="ts">
  import { ref } from 'vue'
  // Shared component that lives in the main ITS app (app/components/shared).
  // Importing it here proves UI code can be reused in the widget.
  import StatusPill from '../../app/components/shared/StatusPill.vue'
  import WidgetTicketForm from './WidgetTicketForm.vue'

  // Values passed in from main.ts (site-tag="..." becomes siteTag)
  const props = defineProps<{ siteTag: string; apiBase: string }>()

  const open = ref(false)
  const state = ref<'idle' | 'loading' | 'ok' | 'error'>('idle')

  // Ticket submission state
  const submitting = ref(false)
  const result = ref<'idle' | 'sent' | 'error'>('idle')
  const message = ref('')

  // Reachability check only: /api/health does not validate the site tag yet.
  // Site-tag validation lands with the widget submission endpoint in #32.

  async function checkConnection() {
    state.value = 'loading'
    try {
      const res = await fetch(
        `${props.apiBase}/api/health?siteTag=${encodeURIComponent(props.siteTag)}`
      )
      state.value = res.ok ? 'ok' : 'error'
    } catch {
      state.value = 'error'
    }
  }

  function toggle() {
    open.value = !open.value
    if (open.value) checkConnection()
  }

  // The form only reports what the user typed; the widget sends it to ITS.
  async function submitTicket(ticket: { title: string; description: string }) {
    submitting.value = true
    message.value = ''
    try {
      const res = await fetch(`${props.apiBase}/api/widget/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteTag: props.siteTag, ...ticket }),
      })

      if (res.status === 201) {
        result.value = 'sent'
        message.value = 'Thanks! Your report was sent.'
      } else if (res.status === 429) {
        // Retry-After is in seconds; show it in minutes.
        const seconds = Number(res.headers.get('Retry-After')) || 60
        const minutes = Math.ceil(seconds / 60)
        result.value = 'error'
        message.value = `Too many reports. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
      } else {
        result.value = 'error'
        message.value = 'Something went wrong. Please try again.'
      }
    } catch {
      // Network error, or ITS is down
      result.value = 'error'
      message.value = 'Could not reach ITS. Please try again later.'
    } finally {
      submitting.value = false
    }
  }

  // Show a fresh, empty form again.
  function reportAnother() {
    result.value = 'idle'
    message.value = ''
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

      <!-- After a successful submit, show a thank-you instead of the form. -->
      <div v-if="result === 'sent'" class="sent">
        <p class="message ok">{{ message }}</p>
        <button class="link" @click="reportAnother">Report another issue</button>
      </div>

      <template v-else>
        <WidgetTicketForm :submitting="submitting" @submit="submitTicket" />
        <p v-if="message" class="message error">{{ message }}</p>
      </template>
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
    width: 320px;
    padding: 16px;
    background: white;
    color: #111827;
    border-radius: 12px;
    box-shadow: 0 8px 30px rgb(0 0 0 / 0.18);
    display: flex;
    flex-direction: column;
    gap: 12px;
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
  .message {
    font-size: 13px;
    margin: 0;
  }
  .message.ok {
    color: #166534;
  }
  .message.error {
    color: #b91c1c;
  }
  .link {
    border: none;
    background: none;
    padding: 0;
    color: #2563eb;
    font-size: 13px;
    cursor: pointer;
    text-decoration: underline;
  }
  .panel > .status-pill {
    align-self: flex-start;
  }
</style>
