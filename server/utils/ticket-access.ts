import { and, eq } from 'drizzle-orm'
import { createError, type H3Event } from 'h3'
import { project, tickets, user } from '../db/schema'
import { db } from './db'
import { requireUser } from './session'

type Reader = Pick<typeof db, 'select'>

export function requireTicketUser(event: H3Event, reader: Reader = db) {
  const identity = requireUser(event)
  const currentUser = reader
    .select({ id: user.id, orgId: user.orgId })
    .from(user)
    .where(eq(user.id, identity.id))
    .get()
  if (!currentUser) {
    throw createError({ statusCode: 403, statusMessage: 'Account access unavailable' })
  }
  return currentUser
}

export function projectAccessScope(currentUser: { orgId: string | null }) {
  return currentUser.orgId === null ? undefined : eq(project.projectPartnerId, currentUser.orgId)
}

export function requireAccessibleProject(
  id: number,
  currentUser: { orgId: string | null },
  reader: Reader = db
) {
  const found = reader
    .select({ id: project.id })
    .from(project)
    .where(and(eq(project.id, id), projectAccessScope(currentUser)))
    .get()
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
  return found
}

export const ticketSummaryColumns = {
  id: tickets.id,
  title: tickets.title,
  status: tickets.status,
  projectId: tickets.projectId,
  projectName: project.name,
  timestamp: tickets.timestamp,
}

export function readAccessibleTicket(
  id: number,
  currentUser: { id: string; orgId: string | null },
  reader: Reader = db
) {
  const ticket = reader
    .select({
      ...ticketSummaryColumns,
      description: tickets.description,
      userId: tickets.userId,
      githubIssueId: tickets.githubIssueId,
      submitterName: user.name,
      githubRepo: project.githubRepo,
    })
    .from(tickets)
    .innerJoin(project, eq(project.id, tickets.projectId))
    .leftJoin(user, eq(user.id, tickets.userId))
    .where(and(eq(tickets.id, id), projectAccessScope(currentUser)))
    .get()
  if (!ticket) throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  const { githubRepo, ...detail } = ticket
  // The integration stores issue numbers. Until other ID formats have a contract,
  // display them as text; never turn an arbitrary database value into a URL.
  const githubIssueUrl =
    ticket.githubIssueId &&
    /^[1-9]\d*$/.test(ticket.githubIssueId) &&
    /^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/.test(githubRepo)
      ? `https://github.com/${githubRepo}/issues/${ticket.githubIssueId}`
      : null
  return {
    ...detail,
    githubIssueUrl,
    canEdit: ticket.userId === currentUser.id && ticket.status === 'open',
  }
}

export function parseTicketId(value: string | undefined) {
  if (!value || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw createError({ statusCode: 404, statusMessage: 'Ticket not found' })
  }
  return Number(value)
}
