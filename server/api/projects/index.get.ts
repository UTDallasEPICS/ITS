import { asc } from 'drizzle-orm'
import { defineEventHandler } from 'h3'
import { project } from '../../db/schema'
import { db } from '../../utils/db'
import { projectAccessScope, requireTicketUser } from '../../utils/ticket-access'

export default defineEventHandler((event) => {
  const currentUser = requireTicketUser(event)
  return db
    .select({ id: project.id, name: project.name })
    .from(project)
    .where(projectAccessScope(currentUser))
    .orderBy(asc(project.name), asc(project.id))
    .all()
})
