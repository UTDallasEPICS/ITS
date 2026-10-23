import type { ChatWireMessage } from '#shared/types/chat'

export type { ChatWireMessage }

/**
 * Everything a chat thread needs from its data source.
 *
 * The interface is deliberately auth-agnostic: the ITS session adapter is only
 * the first implementation, and the widget (#7) will plug in a token-authenticated
 * one without the component knowing the difference. That is why `subscribe` is
 * optional — a read-only or snapshot adapter can leave it out and the UI simply
 * reports that live updates are unavailable.
 */
export interface ChatAdapter {
  /**
   * Loads a page of messages ordered oldest first. `after` is an exclusive id
   * cursor used to catch up after a reconnect.
   */
  loadMessages(options?: { after?: number }): Promise<ChatMessagePage>
  /** Persists a message and returns the stored row. */
  sendMessage(body: string): Promise<ChatWireMessage>
  /** Opens a live feed and returns an unsubscribe function. */
  subscribe?(handlers: ChatSubscriptionHandlers): () => void
}

export type ChatMessagePage = {
  messages: ChatWireMessage[]
  metadata: {
    hasMore: boolean
  }
}

export type ChatConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

export type ChatSubscriptionHandlers = {
  onMessage: (message: ChatWireMessage) => void
  onStatusChange?: (status: ChatConnectionStatus) => void
  /**
   * Called after a dropped connection is restored. The adapter cannot know what
   * the consumer has already rendered, so the consumer fetches the gap itself.
   */
  onResync?: () => void | Promise<void>
}
