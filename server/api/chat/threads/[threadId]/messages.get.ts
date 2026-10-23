import { createError, defineEventHandler, getQuery, getRouterParam } from 'h3'
import { z } from 'zod'
import { requireThreadAccess } from '~~/server/utils/chat/access'
import { paginateThreadMessages } from '~~/server/utils/chat/service'
import { requireUser } from '~~/server/utils/session'

/**
 * Thread history, oldest-first inside each page.
 *
 * - no cursor: the newest page, so opening a thread lands at the bottom
 * - `before=<id>`: the page immediately older than that id (infinite scroll up)
 * - `after=<id>`: messages newer than that id (reconnect catch-up)
 *
 * Cursors are exclusive and mutually exclusive with each other.
 */
const querySchema = z
  .object({
    after: z.coerce.number().int().positive().optional(),
    before: z.coerce.number().int().positive().optional(),
    pageSize: z.coerce.number().int().positive().optional(),
  })
  .refine((query) => query.after === undefined || query.before === undefined, {
    message: 'Use either after or before, never both.',
  })

export default defineEventHandler(async (event) => {
  const threadId = Number(getRouterParam(event, 'threadId'))
  if (!Number.isInteger(threadId) || threadId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid thread id' })
  }

  const query = querySchema.safeParse(getQuery(event))
  if (!query.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid pagination parameters' })
  }

  await requireThreadAccess(requireUser(event).id, threadId)

  try {
    // `after` is a forward cursor, so it must read forward. `before` and a bare
    // request read backward, from the cursor or from the newest message.
    return await paginateThreadMessages({
      threadId,
      direction: query.data.after === undefined ? 'latest' : 'oldest',
      cursorMessageId: query.data.after ?? query.data.before,
      pageSize: query.data.pageSize,
    })
  } catch (error) {
    // Anything the service rejects here is a caller-supplied cursor or page
    // size; database failures are not realistically recoverable as 400s, but
    // they are not expected on this path.
    if (error instanceof Error && 'statusCode' in error) throw error
    throw createError({ statusCode: 400, statusMessage: 'Invalid cursor or page size' })
  }
})
