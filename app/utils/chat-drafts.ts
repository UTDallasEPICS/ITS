const DRAFT_PREFIX = 'its:chat-draft:'

export function chatDraftKey(userId: string, threadId: number) {
  return `${DRAFT_PREFIX}${JSON.stringify([userId, threadId])}`
}

export function clearChatDrafts() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(DRAFT_PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    // Storage can be unavailable in private or embedded contexts.
  }
}
