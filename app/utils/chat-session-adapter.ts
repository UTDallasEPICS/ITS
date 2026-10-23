import type {
  ChatAdapter,
  ChatConnectionStatus,
  ChatMessagePage,
  ChatSubscriptionHandlers,
} from '../types/chat'
import type { ChatServerFrame } from '#shared/types/chat'

/** Backoff between reconnect attempts; the last value repeats. */
export const CHAT_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000] as const

/**
 * Narrow fetch surface so the adapter can be tested without Nuxt's `$fetch`.
 * Responses are `unknown` because they cross the network.
 */
export type SessionChatFetcher = (
  path: string,
  options?: {
    method?: 'GET' | 'POST'
    query?: { after: number }
    body?: { plainTextBody: string }
  }
) => Promise<unknown>

export type SessionChatAdapterOptions = {
  fetchImpl?: SessionChatFetcher
  createSocket?: (url: string) => WebSocket
  /** Origin used to build the socket URL; defaults to the current page. */
  origin?: string
}

type SocketFactory = (url: string) => WebSocket

type HubSubscriber = {
  threadId: number
  handlers: ChatSubscriptionHandlers
}

type SocketHub = {
  url: string
  createSocket: SocketFactory
  subscribers: Set<HubSubscriber>
  socket?: WebSocket
  timer?: ReturnType<typeof setTimeout>
  attempts: number
  openedBefore: boolean
  status: ChatConnectionStatus
}

const browserSocket: SocketFactory = (url) => new WebSocket(url)

// The server gives each signed-in user one socket, not one per thread, so every
// mounted thread shares the connection opened by whichever subscribed first.
const hubsByTransport = new WeakMap<SocketFactory, Map<string, SocketHub>>()

function socketUrl(origin: string) {
  const url = new URL('/api/chat/ws', origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function parseFrame(data: unknown): ChatServerFrame | null {
  if (typeof data !== 'string') return null
  try {
    const frame = JSON.parse(data) as ChatServerFrame
    return frame && typeof frame === 'object' && 'type' in frame ? frame : null
  } catch {
    return null
  }
}

function hubFor(url: string, createSocket: SocketFactory) {
  let hubs = hubsByTransport.get(createSocket)
  if (!hubs) {
    hubs = new Map()
    hubsByTransport.set(createSocket, hubs)
  }

  let hub = hubs.get(url)
  if (!hub) {
    hub = {
      url,
      createSocket,
      subscribers: new Set(),
      attempts: 0,
      openedBefore: false,
      status: 'offline',
    }
    hubs.set(url, hub)
  }
  return hub
}

function sendToSubscribers(hub: SocketHub, frame: ChatServerFrame) {
  if (frame.type !== 'message.created') return

  for (const subscriber of hub.subscribers) {
    if (frame.message.threadId === subscriber.threadId) {
      subscriber.handlers.onMessage(frame.message)
    }
  }
}

function setStatus(hub: SocketHub, status: ChatConnectionStatus) {
  hub.status = status
  for (const subscriber of hub.subscribers) {
    subscriber.handlers.onStatusChange?.(status)
  }
}

function connect(hub: SocketHub) {
  setStatus(hub, hub.openedBefore ? 'reconnecting' : 'connecting')

  const socket = hub.createSocket(hub.url)
  hub.socket = socket

  socket.addEventListener('open', () => {
    const isReconnect = hub.openedBefore
    hub.openedBefore = true
    hub.attempts = 0
    setStatus(hub, 'live')

    if (isReconnect) {
      for (const subscriber of hub.subscribers) {
        void subscriber.handlers.onResync?.()
      }
    }
  })

  socket.addEventListener('message', (event) => {
    const frame = parseFrame(event.data)
    if (frame) sendToSubscribers(hub, frame)
  })

  socket.addEventListener('error', () => {
    // A close normally follows; closing here guarantees we reach the retry path
    // when a transport only reports the error.
    socket.close()
  })

  socket.addEventListener('close', () => {
    if (socket !== hub.socket) return
    scheduleReconnect(hub)
  })
}

function scheduleReconnect(hub: SocketHub) {
  if (hub.timer !== undefined) return

  const delay =
    CHAT_RECONNECT_DELAYS_MS[Math.min(hub.attempts, CHAT_RECONNECT_DELAYS_MS.length - 1)] ?? 1_000
  hub.attempts += 1
  setStatus(hub, 'reconnecting')
  hub.timer = setTimeout(() => {
    hub.timer = undefined
    connect(hub)
  }, delay)
}

function releaseHub(hub: SocketHub, createSocket: SocketFactory) {
  if (hub.subscribers.size > 0) return

  if (hub.timer !== undefined) clearTimeout(hub.timer)
  hub.timer = undefined
  const socket = hub.socket
  hub.socket = undefined
  socket?.close()
  hubsByTransport.get(createSocket)?.delete(hub.url)
}

/**
 * Chat adapter for ITS pages: the session cookie authenticates both the HTTP
 * calls and the WebSocket upgrade, so no token plumbing is needed here.
 *
 * The socket is server -> client only; sends stay on POST /messages and come
 * back over the socket, which the composable de-duplicates by id. A frame for a
 * different thread is dropped here, since the connection carries every thread
 * the signed-in user is a member of. Reconnects use a short capped backoff and
 * trigger a catch-up fetch for whatever was missed.
 */
export function createSessionChatAdapter(
  threadId: number,
  options: SessionChatAdapterOptions = {}
): ChatAdapter {
  const fetcher: SessionChatFetcher = options.fetchImpl ?? ((path, config) => $fetch(path, config))
  const createSocket = options.createSocket ?? browserSocket
  const url = socketUrl(
    options.origin ??
      (typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin)
  )
  const messagesPath = `/api/chat/threads/${threadId}/messages`

  async function loadMessages(loadOptions: { after?: number } = {}) {
    const after = loadOptions.after
    return (await fetcher(
      messagesPath,
      after ? { query: { after } } : undefined
    )) as ChatMessagePage
  }

  async function sendMessage(body: string) {
    return (await fetcher(messagesPath, {
      method: 'POST',
      body: { plainTextBody: body },
    })) as ChatMessagePage['messages'][number]
  }

  function subscribe(handlers: ChatSubscriptionHandlers) {
    const hub = hubFor(url, createSocket)
    const subscriber: HubSubscriber = { threadId, handlers }
    hub.subscribers.add(subscriber)

    if (!hub.socket && hub.timer === undefined) {
      connect(hub)
    } else {
      handlers.onStatusChange?.(hub.status)
    }

    return () => {
      hub.subscribers.delete(subscriber)
      releaseHub(hub, createSocket)
    }
  }

  return { loadMessages, sendMessage, subscribe }
}
