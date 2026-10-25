import { createError, defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { requireThreadAccess } from '~~/server/utils/chat/access'
import { sendMessage } from '~~/server/utils/chat/service'
import { requireUser } from '~~/server/utils/session'

// Identity comes from the session, never the body.
const bodySchema = z.strictObject({
  plainTextBody: z.string().trim().min(1, 'Enter a message.'),
})

export default defineEventHandler(async (event) => {
  const threadId = Number(getRouterParam(event, 'threadId'))
  if (!Number.isInteger(threadId) || threadId <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid thread id' })
  }

  const user = requireUser(event)
  await requireThreadAccess(user.id, threadId)

  const body = bodySchema.safeParse(await readBody(event))
  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid message' })
  }

  const result = await sendMessage({
    threadId,
    userId: user.id,
    plainTextBody: body.data.plainTextBody,
  })

  if (!result.ok) {
    throw createError({ statusCode: 404, statusMessage: 'Thread not found' })
  }

  setResponseStatus(event, 201)
  return result.value
})
