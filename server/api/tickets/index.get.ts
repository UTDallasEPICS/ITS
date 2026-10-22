import { and, desc, eq } from 'drizzle-orm'
import { createError, defineEventHandler, getQuery } from 'h3'
import { z } from 'zod'
import { project, tickets } from '../../db/schema'
import { db } from '../../utils/db'
import {
  projectAccessScope,
  requireAccessibleProject,
  requireTicketUser,
  ticketSummaryColumns,
} from '../../utils/ticket-access'

const filtersSchema = z.strictObject({
  projectId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().positive())
    .optional(),
  status: z.string().trim().min(1).optional(),
})

export default defineEventHandler((event) => {
  const currentUser = requireTicketUser(event)
  const filters = filtersSchema.safeParse(getQuery(event))
  if (!filters.success)
    throw createError({ statusCode: 400, statusMessage: 'Invalid ticket filters' })
  if (filters.data.projectId !== undefined)
    requireAccessibleProject(filters.data.projectId, currentUser)
  return db
    .select(ticketSummaryColumns)
    .from(tickets)
    .innerJoin(project, eq(project.id, tickets.projectId))
    .where(
      and(
        projectAccessScope(currentUser),
        filters.data.projectId === undefined
          ? undefined
          : eq(tickets.projectId, filters.data.projectId),
        filters.data.status === undefined ? undefined : eq(tickets.status, filters.data.status)
      )
    )
    .orderBy(desc(tickets.timestamp), desc(tickets.id))
    .all()
})
