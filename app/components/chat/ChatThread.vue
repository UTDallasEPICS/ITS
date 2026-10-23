<script setup lang="ts">
  import { computed, nextTick, onMounted, ref, watch } from 'vue'
  import { useChatThread } from '../../composables/useChatThread'
  import type { ChatAdapter } from '../../types/chat'

  /**
   * Reusable thread UI. It knows nothing about ITS auth or routing: everything
   * data-shaped arrives through `adapter`, which is what lets the partner widget
   * (#7) reuse this component with token auth.
   *
   * `adapter` is expected to be stable for the life of the component. Render one
   * instance per thread (`:key="threadId"`) so changing threads also resets state
   * and closes the previous socket.
   */
  const props = defineProps<{
    adapter: ChatAdapter
    /** Highlights the signed-in user's own messages. */
    currentUserId?: string
    /** Optional userId -> display name map; ids are shown when a name is missing. */
    authorNames?: Record<string, string>
    title?: string
  }>()

  const {
    messages,
    loadState,
    loadError,
    sendError,
    sending,
    connection,
    start,
    retry,
    sendMessage,
  } = useChatThread(props.adapter)

  const draft = ref('')
  const list = ref<HTMLElement | null>(null)

  const canSend = computed(
    () => draft.value.trim().length > 0 && !sending.value && loadState.value === 'ready'
  )

  const connectionLabel = computed(() => {
    switch (connection.value) {
      case 'connecting':
        return 'Connecting…'
      case 'live':
        return 'Live'
      case 'reconnecting':
        return 'Reconnecting…'
      default:
        return 'Live updates unavailable'
    }
  })

  onMounted(() => {
    void start()
  })

  // Keep the newest message in view as history loads and as messages arrive.
  watch(
    () => messages.value.length,
    async () => {
      await nextTick()
      if (list.value) list.value.scrollTop = list.value.scrollHeight
    }
  )

  function authorName(userId: string) {
    return props.authorNames?.[userId] ?? userId
  }

  function formatTimestamp(createdAt: string) {
    const date = new Date(createdAt)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  async function submit() {
    if (!canSend.value) return
    if (await sendMessage(draft.value)) draft.value = ''
  }
</script>

<template>
  <section
    class="flex h-full flex-col rounded-lg border border-gray-200 dark:border-gray-800"
    aria-label="Conversation"
  >
    <header
      class="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800"
    >
      <h2 class="text-base font-semibold">{{ title ?? 'Conversation' }}</h2>
      <p v-if="adapter.subscribe" role="status" class="text-muted text-xs">
        {{ connectionLabel }}
      </p>
    </header>

    <div
      ref="list"
      class="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      role="log"
      aria-label="Messages"
    >
      <p
        v-if="loadState === 'loading' || loadState === 'idle'"
        role="status"
        class="text-muted text-sm"
      >
        Loading messages…
      </p>

      <template v-else-if="loadState === 'error'">
        <UAlert
          role="alert"
          color="error"
          title="Unable to load messages"
          :description="loadError"
        />
        <UButton variant="soft" @click="retry()">Try again</UButton>
      </template>

      <p v-else-if="messages.length === 0" role="status" class="text-muted text-sm">
        No messages yet. Say hello.
      </p>

      <ul v-else class="space-y-3">
        <li
          v-for="message in messages"
          :key="message.id"
          class="max-w-[85%] rounded-lg px-3 py-2"
          :class="
            message.userId === currentUserId
              ? 'bg-primary-50 dark:bg-primary-950 ml-auto'
              : 'bg-gray-100 dark:bg-gray-800'
          "
        >
          <p class="text-xs font-medium">{{ authorName(message.userId) }}</p>
          <p class="text-sm break-words whitespace-pre-wrap">{{ message.plainTextBody }}</p>
          <p class="text-muted mt-1 text-right text-[11px]">
            {{ formatTimestamp(message.createdAt) }}
          </p>
        </li>
      </ul>
    </div>

    <form
      class="space-y-2 border-t border-gray-200 px-4 py-3 dark:border-gray-800"
      @submit.prevent="submit"
    >
      <UAlert
        v-if="sendError"
        role="alert"
        color="error"
        title="Unable to send message"
        :description="sendError"
      />
      <label for="chat-thread-message" class="sr-only">Message</label>
      <UTextarea
        id="chat-thread-message"
        v-model="draft"
        :rows="3"
        :disabled="loadState !== 'ready'"
        placeholder="Write a message…"
        class="w-full"
      />
      <div class="flex justify-end">
        <UButton type="submit" :disabled="!canSend">
          {{ sending ? 'Sending…' : 'Send' }}
        </UButton>
      </div>
    </form>
  </section>
</template>
