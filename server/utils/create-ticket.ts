import type { H3Event } from 'h3'
import { createTicketSchema } from '#shared/tickets'
import { tickets } from '../db/schema'
import { db } from './db'
import { createGitHubIssue } from './github-issues'
import { requireAccessibleProject, requireTicketUser } from './ticket-access'

// Authenticated submission entry point. The public widget must resolve its own trusted
// identity/project access before sharing persistence; never accept caller-supplied roles.
export async function createTicket(event: H3Event, input: unknown) {
  const values = createTicketSchema.parse(input)

  // Resolve access before the network call so an unauthorized caller cannot use
  // this endpoint to create issues in another project's repository.
  const currentUser = requireTicketUser(event)
  const accessibleProject = requireAccessibleProject(values.projectId, currentUser)

  const githubIssueId = accessibleProject.githubRepo
    ? await createGitHubIssue(accessibleProject.githubRepo, values.title, values.description)
    : null

  return db.transaction((tx) => {
    // Re-check inside the write transaction in case access changed meanwhile.
    requireTicketUser(event, tx)
    requireAccessibleProject(values.projectId, currentUser, tx)
    return tx
      .insert(tickets)
      .values({
        ...values,
        userId: currentUser.id,
        status: 'open',
        timestamp: new Date().toISOString(),
        githubIssueId,
      })
      .returning()
      .get()
  })
}
