import { defineEventHandler, getRouterParam } from 'h3'
import { parseTicketId, readAccessibleTicket, requireTicketUser } from '../../utils/ticket-access'

export default defineEventHandler((event) => {
  const currentUser = requireTicketUser(event)
  return readAccessibleTicket(parseTicketId(getRouterParam(event, 'id')), currentUser)
})
