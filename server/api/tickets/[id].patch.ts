import { eq } from 'drizzle-orm'
import { createError, defineEventHandler, getRouterParam, readBody } from 'h3'
import { updateTicketSchema } from '../../../shared/tickets'
import { tickets } from '../../db/schema'
import { db } from '../../utils/db'
import { requireUser } from '../../utils/session'
import { parseTicketId, readAccessibleTicket, requireTicketUser } from '../../utils/ticket-access'

export default defineEventHandler(async (event) => {
  requireUser(event)
  const id = parseTicketId(getRouterParam(event, 'id'))
  const result = updateTicketSchema.safeParse(await readBody(event))
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Invalid ticket data' })
  return db.transaction((tx) => {
    const currentUser = requireTicketUser(event, tx)
    const ticket = readAccessibleTicket(id, currentUser, tx)
    // Authors can edit the content of their own open tickets only.
    if (!ticket.canEdit)
      throw createError({ statusCode: 403, statusMessage: 'Ticket cannot be edited' })
    tx.update(tickets).set(result.data).where(eq(tickets.id, id)).run()
    return readAccessibleTicket(id, currentUser, tx)
  })
})
