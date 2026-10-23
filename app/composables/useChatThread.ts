import { computed, getCurrentScope, onScopeDispose, ref } from 'vue'
import type { ChatAdapter, ChatConnectionStatus, ChatWireMessage } from '../types/chat'

export type ChatLoadState = 'idle' | 'loading' | 'ready' | 'error'

/**
 * State and lifecycle for one chat thread, independent of where the messages
 * come from or who the user is.
 *
 * `adapter` is expected to be stable for the lifetime of the composable. Swapping
 * threads should recreate the caller (for example with `:key="threadId"`), which
 * also tears down the socket cleanly through `onScopeDispose`.
 */
export function useChatThread(adapter: ChatAdapter) {
  const messages = ref<ChatWireMessage[]>([])
  const loadState = ref<ChatLoadState>('idle')
  const loadError = ref('')
  const sendError = ref('')
  const sending = ref(false)
  const connection = ref<ChatConnectionStatus>('offline')

  let unsubscribe: (() => void) | undefined

  const lastMessageId = computed(() => messages.value[messages.value.length - 1]?.id ?? 0)

  /** Appends anything unseen and keeps the list in server order. */
  function mergeMessages(incoming: ChatWireMessage[]) {
    if (incoming.length === 0) return

    const seen = new Set(messages.value.map((message) => message.id))
    const fresh = incoming.filter((message) => !seen.has(message.id))
    if (fresh.length === 0) return

    messages.value = [...messages.value, ...fresh].sort((a, b) => a.id - b.id)
  }

  async function loadHistory(after?: number) {
    const page = await adapter.loadMessages(after === undefined ? undefined : { after })
    mergeMessages(page.messages)
  }

  function connect() {
    // Some adapters are snapshot-only; there is nothing to reconnect to.
    if (!adapter.subscribe) {
      connection.value = 'offline'
      return
    }

    unsubscribe = adapter.subscribe({
      onMessage: (message) => mergeMessages([message]),
      onStatusChange: (status) => {
        connection.value = status
      },
      // The socket only carries messages sent after it connected, so a restored
      // connection has to fetch the gap explicitly.
      onResync: async () => {
        try {
          await loadHistory(lastMessageId.value || undefined)
        } catch {
          // Keep the thread usable; the next reconnect tries again.
        }
      },
    })
  }

  async function start() {
    if (loadState.value === 'loading' || loadState.value === 'ready') return

    loadState.value = 'loading'
    loadError.value = ''

    // Subscribe before reading history: a message sent while the page request is
    // in flight is merged from the socket and de-duplicated by id afterwards, so
    // nothing can slip through the gap between the read and the open socket.
    connect()

    try {
      await loadHistory()
      loadState.value = 'ready'
    } catch {
      stop()
      loadState.value = 'error'
      loadError.value = 'We could not load this conversation. Please try again.'
    }
  }

  async function retry() {
    loadState.value = 'idle'
    await start()
  }

  async function sendMessage(body: string) {
    const trimmed = body.trim()
    if (!trimmed || sending.value) return false

    sending.value = true
    sendError.value = ''

    try {
      mergeMessages([await adapter.sendMessage(trimmed)])
      return true
    } catch {
      sendError.value =
        'We could not send your message. Your draft is still here. Please try again.'
      return false
    } finally {
      sending.value = false
    }
  }

  function stop() {
    unsubscribe?.()
    unsubscribe = undefined
  }

  // Direct composable tests have no component scope; only hook cleanup when there
  // is one, otherwise the warning is noise.
  if (getCurrentScope()) onScopeDispose(stop)

  return {
    messages,
    loadState,
    loadError,
    sendError,
    sending,
    connection,
    lastMessageId,
    start,
    retry,
    sendMessage,
    stop,
  }
}
