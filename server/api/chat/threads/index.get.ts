import { createError, defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { listThreadsForUser } from '~~/server/utils/chat/service'
import { requireUser } from '~~/server/utils/session'

const querySchema = z.object({
  after: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
})

export default defineEventHandler(async (event) => {
  const query = querySchema.safeParse(getQuery(event))
  if (!query.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid pagination parameters' })
  }

  const result = await listThreadsForUser({
    userId: requireUser(event).id,
    afterThreadId: query.data.after,
    pageSize: query.data.pageSize,
  })
  if (!result.ok) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid page size' })
  }
  return result.value
})
