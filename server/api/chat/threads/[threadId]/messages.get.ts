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
const cursorSchema = z.coerce.number().int().positive()
const pageSchema = z.object({
  pageSize: z.coerce.number().int().positive().optional(),
})
const querySchema = z.union([
  z.object({ after: cursorSchema, before: z.never().optional() }),
  z.object({ before: cursorSchema, after: z.never().optional() }),
  z.object({ after: z.never().optional(), before: z.never().optional() }),
]).and(pageSchema)

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

  const result = await paginateThreadMessages({
    threadId,
    direction: query.data.after === undefined ? 'latest' : 'oldest',
    cursorMessageId: query.data.after ?? query.data.before,
    pageSize: query.data.pageSize,
  })
  if (!result.ok) {
    if (result.error === 'thread-not-found') {
      throw createError({ statusCode: 404, statusMessage: 'Thread not found' })
    }
    throw createError({ statusCode: 400, statusMessage: 'Invalid cursor or page size' })
  }
  return result.value
})
