import type { tickets } from '~~/server/db/schema'

/**
 * Fields:
 * - id: number
 * - projectId: number
 * - title: string
 * - status: string
 * - userId: string | null
 * - description: string
 * - timestamp: string (Date Created)
 * - githubIssueId: string | null
 */
export type Ticket = typeof tickets.$inferSelect

export const MOCK_TICKETS: Ticket[] = [
  {
    id: 1,
    projectId: 1,
    title: 'DX/Feature: Build NPTS ticket detail view',
    status: 'In Progress',
    userId: 'usr_epics_lead_2026',
    description:
      'Build dynamic ticket detail view for NPTS members and project partners. Displays core metadata matching the database schema (ID, Title, Description, Status, Date Created / timestamp, Project ID, User ID, and GitHub Issue ID).',
    timestamp: '2026-10-08T10:30:00Z',
    githubIssueId: '46',
  },
  {
    id: 46,
    projectId: 1,
    title: 'DX/Feature: Build NPTS ticket detail view',
    status: 'In Progress',
    userId: 'usr_epics_lead_2026',
    description:
      'Implement the ticket detail dynamic view in the Issue Tracking System. The view must display core ticket details including Ticket ID, Title, Description, Status, and Date Created, while strictly aligning with the database schema types.',
    timestamp: '2026-10-08T10:30:00Z',
    githubIssueId: '46',
  },
  {
    id: 2,
    projectId: 1,
    title: 'Fix session token expiration validation on mobile safari',
    status: 'Open',
    userId: 'usr_qa_02',
    description:
      'Session cookies fail to refresh periodically when the user minimizes Mobile Safari during OTP authentication flows.',
    timestamp: '2026-10-06T14:15:00Z',
    githubIssueId: '32',
  },
  {
    id: 3,
    projectId: 2,
    title: 'Implement automated repository sync webhook',
    status: 'Closed',
    userId: null,
    description:
      'Sync ITS tickets with GitHub issues via repository webhooks whenever a label or status changes.',
    timestamp: '2026-09-28T09:00:00Z',
    githubIssueId: '14',
  },
]

/**
 * Fetch a ticket by ID using mock data.
 * If not found in static list, generates a fallback mock ticket for demonstration.
 */
export function getMockTicketById(id: number | string): Ticket | null {
  const numericId = Number(id)
  if (isNaN(numericId)) return null

  const found = MOCK_TICKETS.find((t) => t.id === numericId)
  if (found) return found

  // Fallback realistic ticket for any numeric ID tested
  return {
    id: numericId,
    projectId: 1,
    title: `Sample Ticket #${numericId}`,
    status: 'Open',
    userId: 'usr_sample_dev',
    description: `This is a generated mock ticket detail view for Ticket ID #${numericId}. All fields match server/db/schema.ts.`,
    timestamp: new Date().toISOString(),
    githubIssueId: String(numericId),
  }
}
