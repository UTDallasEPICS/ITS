<script setup lang="ts">
  import { computed, ref } from 'vue'
  import ChatThread from '../components/chat/ChatThread.vue'
  import type { ChatAdapter, ChatConnectionStatus, ChatSubscriptionHandlers, ChatWireMessage } from '../types/chat'

  const currentUserId = 'chat-playground-user'
  const authorNames = { [currentUserId]: 'You · NPTS', partner: 'Ada · North Texas Community Center' }
  const sample = [
    'Hi! We are preparing the community website for launch next week.',
    'Great. Which part would you like us to take a look at first?',
    'The volunteer signup form. A few people said they could not finish submitting it on their phone.',
    'Could you share the browser and the step where they got stuck? We can try to reproduce it.',
    'Safari on an iPhone. It happens after they select their availability and press Continue.',
    'Thanks, that gives us a good starting point. We will check the mobile layout and validation.',
  ]
  let nextMessageId = 1
  function makeMessage(threadId: number, body: string, userId = 'partner'): ChatWireMessage {
    return { id: nextMessageId++, threadId, userId, plainTextBody: body, createdAt: new Date().toISOString() }
  }

  const threads = ref([
    { id: 1, title: 'Community website', messages: Array.from({ length: 24 }, (_, index) =>
      makeMessage(1, sample[index % sample.length]!, index % 2 ? currentUserId : 'partner')) },
    { id: 2, title: 'Volunteer onboarding', messages: [makeMessage(2, 'Can we review the new volunteer welcome email?')] },
  ])
  const selectedThreadId = ref(1)
  const selectedThread = computed(() => threads.value.find(thread => thread.id === selectedThreadId.value)!)
  const connection = ref<ChatConnectionStatus>('live')
  const failNextSend = ref(false)
  const failNextLoad = ref(false)
  const generation = ref(0)
  const subscriptions = new Map<number, Set<ChatSubscriptionHandlers>>()
  const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

  const adapter = computed<ChatAdapter>(() => {
    const thread = selectedThread.value
    return {
      async loadMessages(options) {
        await pause(180)
        if (failNextLoad.value) {
          failNextLoad.value = false
          throw new Error('Simulated history failure')
        }
        const messages = thread.messages.filter(message => options?.after === undefined || message.id > options.after)
        return { messages: [...messages], metadata: { hasMore: false } }
      },
      async sendMessage(body) {
        await pause(300)
        if (failNextSend.value || connection.value !== 'live') {
          failNextSend.value = false
          throw new Error('Simulated send failure')
        }
        const message = makeMessage(thread.id, body, currentUserId)
        thread.messages.push(message)
        for (const handlers of subscriptions.get(thread.id) ?? []) handlers.onMessage(message)
        return message
      },
      subscribe(handlers) {
        const listeners = subscriptions.get(thread.id) ?? new Set<ChatSubscriptionHandlers>()
        subscriptions.set(thread.id, listeners)
        listeners.add(handlers)
        handlers.onStatusChange?.(connection.value)
        return () => {
          listeners.delete(handlers)
          if (!listeners.size) subscriptions.delete(thread.id)
        }
      },
    }
  })

  function incomingMessage() {
    const thread = selectedThread.value
    const message = makeMessage(thread.id, 'A new update from Ada. We tested the form again and have a little more detail to share.')
    thread.messages.push(message)
    if (connection.value === 'live') {
      for (const handlers of subscriptions.get(thread.id) ?? []) handlers.onMessage(message)
    }
  }

  function changeConnection() {
    connection.value = connection.value === 'live' ? 'reconnecting' : 'live'
    for (const listeners of subscriptions.values()) {
      for (const handlers of listeners) {
        handlers.onStatusChange?.(connection.value)
        if (connection.value === 'live') void handlers.onResync?.()
      }
    }
  }

  function newThread() {
    const id = Math.max(...threads.value.map(thread => thread.id)) + 1
    threads.value.push({ id, title: `New conversation ${id}`, messages: [] })
    selectedThreadId.value = id
  }

  function failHistory() {
    failNextLoad.value = true
    generation.value++
  }
</script>

<template>
  <UContainer class="py-8">
    <div class="mb-6">
      <p class="text-primary mb-2 text-xs font-semibold tracking-wider uppercase">Development only</p>
      <h1 class="text-3xl font-bold tracking-tight">Chat playground</h1>
      <p class="text-muted mt-2 max-w-2xl text-sm">
        Sample conversations using the real chat component. Messages and connection events are simulated; no real chat data is read or changed.
      </p>
    </div>

    <div class="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside class="space-y-6">
        <nav aria-label="Sample conversations" class="space-y-2">
          <h2 class="text-muted mb-3 text-xs font-semibold tracking-wider uppercase">Conversations</h2>
          <UButton
            v-for="thread in threads"
            :key="thread.id"
            :variant="selectedThreadId === thread.id ? 'soft' : 'ghost'"
            :color="selectedThreadId === thread.id ? 'primary' : 'neutral'"
            :aria-pressed="selectedThreadId === thread.id"
            class="w-full justify-start"
            @click="selectedThreadId = thread.id"
          >{{ thread.title }}</UButton>
        </nav>

        <div class="space-y-3 border-t border-gray-200 pt-5 dark:border-gray-800">
          <h2 class="text-muted text-xs font-semibold tracking-wider uppercase">Simulate</h2>
          <UButton variant="outline" class="w-full justify-start" @click="incomingMessage">Incoming message</UButton>
          <UButton variant="outline" class="w-full justify-start" @click="newThread">New conversation</UButton>
          <UButton variant="outline" color="neutral" class="w-full justify-start" @click="changeConnection">
            {{ connection === 'live' ? 'Disconnect' : 'Reconnect' }}
          </UButton>
          <UButton variant="outline" color="neutral" class="w-full justify-start" :aria-pressed="failNextSend" @click="failNextSend = !failNextSend">
            {{ failNextSend ? 'Next send will fail' : 'Fail next send' }}
          </UButton>
          <UButton variant="outline" color="neutral" class="w-full justify-start" @click="failHistory">Fail history load</UButton>
        </div>

        <p class="text-muted text-sm">
          Scroll up, then add an incoming message. Type a draft and switch conversations or refresh to restore it.
          Disconnect, add messages, and reconnect to catch up. Notifications and sounds are deferred.
        </p>
      </aside>

      <div class="h-[min(720px,calc(100dvh-240px))] min-h-[440px]">
        <ChatThread
          :key="`${selectedThreadId}:${generation}`"
          :adapter="adapter"
          :thread-id="selectedThreadId"
          :current-user-id="currentUserId"
          :author-names="authorNames"
          :title="selectedThread.title"
        />
      </div>
    </div>
  </UContainer>
</template>
