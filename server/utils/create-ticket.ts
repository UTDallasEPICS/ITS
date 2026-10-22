import type { H3Event } from 'h3'
import { createTicketSchema } from '../../shared/tickets'
import { tickets } from '../db/schema'
import { db } from './db'
import { requireAccessibleProject, requireTicketUser } from './ticket-access'

// Authenticated submission entry point. The public widget must resolve its own trusted
// identity/project access before sharing persistence; never accept caller-supplied roles.
export function createTicket(event: H3Event, input: unknown) {
  const values = createTicketSchema.parse(input)
  return db.transaction((tx) => {
    const currentUser = requireTicketUser(event, tx)
    requireAccessibleProject(values.projectId, currentUser, tx)
    return tx
      .insert(tickets)
      .values({
        ...values,
        userId: currentUser.id,
        status: 'open',
        timestamp: new Date().toISOString(),
      })
      .returning()
      .get()
  })
}
