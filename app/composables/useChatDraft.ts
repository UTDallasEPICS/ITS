import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { chatDraftKey } from '../utils/chat-drafts'

export function useChatDraft(userId: () => string | undefined, threadId: () => number | undefined) {
  const draft = ref('')
  const key = computed(() => {
    const user = userId()
    const thread = threadId()
    return user && thread !== undefined ? chatDraftKey(user, thread) : undefined
  })
  let mounted = false
  let restoring = false

  function restore() {
    restoring = true
    try {
      draft.value = key.value ? localStorage.getItem(key.value) ?? '' : ''
    } catch {
      draft.value = ''
    } finally {
      restoring = false
    }
  }

  watch(key, () => { if (mounted) restore() }, { flush: 'sync' })
  watch(draft, (body) => {
    if (!mounted || restoring || !key.value) return
    try {
      if (body) localStorage.setItem(key.value, body)
      else localStorage.removeItem(key.value)
    } catch {
      // A storage failure must not prevent composing or sending.
    }
  }, { flush: 'sync' })

  function onStorage(event: StorageEvent) {
    if (event.key === key.value || event.key === null) restore()
  }

  onMounted(() => {
    mounted = true
    restore()
    window.addEventListener('storage', onStorage)
  })
  onScopeDispose(() => window.removeEventListener('storage', onStorage))

  return draft
}
