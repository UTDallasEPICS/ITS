import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'
import { createTicketSchema } from '../../../shared/tickets'
import { createTicket } from '../../utils/create-ticket'
import { requireUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  requireUser(event)
  const result = createTicketSchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid ticket data' })
  const ticket = createTicket(event, result.data)
  setResponseStatus(event, 201)
  return ticket
})
