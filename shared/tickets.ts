import { z } from 'zod'
import type { tickets } from '../server/db/schema'

// Shared by the widget, ITS form and API; identity and status are server-owned.
export const createTicketSchema = z.strictObject({
  projectId: z.number({ error: 'Choose a project.' }).int().positive(),
  title: z.string().trim().min(1, 'Enter a ticket title.'),
  description: z.string().trim().min(1, 'Describe the issue.'),
})
export const updateTicketSchema = createTicketSchema.pick({ title: true, description: true })
export type TicketFormValues = z.infer<typeof createTicketSchema>
export interface TicketProjectOption {
  id: number
  name: string
}
type Ticket = typeof tickets.$inferSelect
export type TicketSummary = Pick<Ticket, 'id' | 'title' | 'status' | 'projectId' | 'timestamp'> & {
  projectName: string
}
export type TicketDetail = TicketSummary &
  Pick<Ticket, 'description' | 'userId' | 'githubIssueId'> & {
    submitterName: string | null
    githubIssueUrl: string | null
    canEdit: boolean
  }
