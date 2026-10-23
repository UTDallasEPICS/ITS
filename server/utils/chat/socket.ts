import type { Hooks, Peer } from 'crossws'
import { eq } from 'drizzle-orm'
import { auth } from '~~/server/utils/auth'
import { chatThreadMembers } from '~~/server/db/schema'
import { db } from '~~/server/utils/db'
import {
  sendFrame,
  startHeartbeat,
  stopHeartbeat,
  subscribePeer,
  unsubscribePeer,
} from './ws'

/**
 * One socket per signed-in user, carrying everything chat-related they can see.
 *
 * The session, not the URL, decides what arrives: the peer is indexed into the
 * threads it is already a member of at connect, and threads created later are
 * added by the `chat:thread-created` listener. Sends still go through
 * POST /messages; this socket is server -> client only.
 *
 * Reconnect contract: open the socket, then fetch what was missed over HTTP
 * (`after=<last id>` for a thread, `after=<last thread id>` for the list). The
 * server does not replay history, so an interrupted connection is recoverable
 * without socket state.
 */
export const chatSocketHooks: Partial<Hooks> = {
  async upgrade(request) {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return new Response(null, { status: 401 })
    }

    const threadIds = db
      .select({ threadId: chatThreadMembers.threadId })
      .from(chatThreadMembers)
      .where(eq(chatThreadMembers.userId, session.user.id))
      .all()
      .map(row => row.threadId)

    return { context: { userId: session.user.id, threadIds } }
  },

  open(peer) {
    const { userId, threadIds } = peer.context
    if (typeof userId !== 'string' || !Array.isArray(threadIds)) {
      peer.close(4400, 'Missing session')
      return
    }

    subscribePeer(userId, threadIds as number[], peer)
    sendFrame(peer, { type: 'ready' })
    startHeartbeat(peer)
  },

  message(peer, message) {
    const frame = message.json<{ type?: string }>()
    if (frame?.type === 'ping') {
      sendFrame(peer, { type: 'pong' })
    }
  },

  close(peer) {
    release(peer)
  },

  error(peer) {
    release(peer)
  },
}

function release(peer: Peer) {
  unsubscribePeer(peer)
  stopHeartbeat(peer)
}
