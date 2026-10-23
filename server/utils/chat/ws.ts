import type { Peer } from 'crossws'
import type { ChatServerFrame, ChatWireMessage, ChatWireThread } from '../../../shared/types/chat'
import type { selectChatThreadMessagesSchema, selectChatThreadsSchema } from '../../db/schema'

// In-process fan-out. Single-replica deployment is an explicit ADR constraint,
// so module-local maps are enough; scaling out replaces this with a broker.
type Subscription = {
  userId: string
  threadIds: Set<number>
}

const peersByThread = new Map<number, Set<Peer>>()
const peersByUser = new Map<string, Set<Peer>>()
const subscriptions = new Map<Peer, Subscription>()
const heartbeats = new Map<Peer, ReturnType<typeof setInterval>>()

export const CHAT_HEARTBEAT_MS = 25_000

function indexThread(peer: Peer, threadId: number) {
  let peers = peersByThread.get(threadId)
  if (!peers) {
    peers = new Set()
    peersByThread.set(threadId, peers)
  }
  peers.add(peer)
}

export function subscribePeer(userId: string, threadIds: number[], peer: Peer) {
  const subscription: Subscription = { userId, threadIds: new Set(threadIds) }
  subscriptions.set(peer, subscription)

  for (const threadId of subscription.threadIds) indexThread(peer, threadId)

  let peers = peersByUser.get(userId)
  if (!peers) {
    peers = new Set()
    peersByUser.set(userId, peers)
  }
  peers.add(peer)
}

export function unsubscribePeer(peer: Peer) {
  const subscription = subscriptions.get(peer)
  if (!subscription) return

  for (const threadId of subscription.threadIds) {
    const peers = peersByThread.get(threadId)
    if (!peers) continue

    peers.delete(peer)
    if (peers.size === 0) peersByThread.delete(threadId)
  }

  const userPeers = peersByUser.get(subscription.userId)
  if (userPeers) {
    userPeers.delete(peer)
    if (userPeers.size === 0) peersByUser.delete(subscription.userId)
  }

  subscriptions.delete(peer)
}

export function threadPeerCount(threadId: number) {
  return peersByThread.get(threadId)?.size ?? 0
}

export function toWireMessage(message: selectChatThreadMessagesSchema): ChatWireMessage {
  return {
    id: message.id,
    threadId: message.threadId,
    userId: message.userId,
    plainTextBody: message.plainTextBody,
    createdAt: message.createdAt.toISOString(),
  }
}

export function toWireThread(thread: selectChatThreadsSchema): ChatWireThread {
  return {
    id: thread.id,
    projectId: thread.projectId,
    createdAt: thread.createdAt.toISOString(),
    closedAt: thread.closedAt?.toISOString() ?? null,
  }
}

export function sendFrame(peer: Peer, frame: ChatServerFrame) {
  try {
    peer.send(JSON.stringify(frame))
  } catch {
    // The peer is already closing; `close` removes it from the registry.
  }
}

export function publishChatMessage(threadId: number, message: ChatWireMessage) {
  const peers = peersByThread.get(threadId)
  if (!peers) return

  for (const peer of peers) {
    sendFrame(peer, { type: 'message.created', message })
  }
}

export function publishThreadCreated(thread: selectChatThreadsSchema, memberIds: string[]) {
  const wire = toWireThread(thread)

  for (const userId of memberIds) {
    const peers = peersByUser.get(userId)
    if (!peers) continue

    for (const peer of peers) {
      const subscription = subscriptions.get(peer)
      if (!subscription) continue

      subscription.threadIds.add(thread.id)
      indexThread(peer, thread.id)
      sendFrame(peer, { type: 'thread.created', thread: wire })
    }
  }
}

export function startHeartbeat(peer: Peer) {
  stopHeartbeat(peer)
  heartbeats.set(
    peer,
    setInterval(() => sendFrame(peer, { type: 'ping' }), CHAT_HEARTBEAT_MS),
  )
}

export function stopHeartbeat(peer: Peer) {
  const heartbeat = heartbeats.get(peer)
  if (!heartbeat) return

  clearInterval(heartbeat)
  heartbeats.delete(peer)
}
