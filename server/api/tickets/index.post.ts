import { and, eq } from 'drizzle-orm'
import { createError, defineEventHandler, readBody, setResponseStatus } from 'h3'
import { z } from 'zod'
import { project, tickets, user } from '../../db/schema'
import { db } from '../../utils/db'
import { requireUser } from '../../utils/session'

interface GitHubIssueResponse {
  id: number
  number: number
  html_url: string
}

// Accept only form fields from the caller
const createTicketSchema = z.strictObject({
  projectId: z.number().int().positive(),
  title: z.string().trim().min(1, 'Enter a ticket title.'),
  description: z.string().trim().min(1, 'Describe the issue.'),
})

export default defineEventHandler(async (event) => {
  // 1. Auth check
  const sessionUser = requireUser(event)

  // 2. Body validation
  const result = createTicketSchema.safeParse(await readBody(event))
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid ticket data' })
  }

  // 3. Verify user and project access, and retrieve project's githubRepo
  const accessibleProject = db.transaction((tx) => {
    const currentUser = tx
      .select({ orgId: user.orgId })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .get()

    if (!currentUser) {
      throw createError({ statusCode: 403, statusMessage: 'Account access unavailable' })
    }

    const proj = tx
      .select({ id: project.id, githubRepo: project.githubRepo })
      .from(project)
      .where(
        and(
          eq(project.id, result.data.projectId),
          currentUser.orgId === null ? undefined : eq(project.projectPartnerId, currentUser.orgId)
        )
      )
      .get()

    if (!proj) {
      throw createError({ statusCode: 404, statusMessage: 'Project not found' })
    }

    return proj
  })

  // 4. Dispatch issue to GitHub REST API
  let githubIssue: GitHubIssueResponse
  try {
    githubIssue = await $fetch<GitHubIssueResponse>(
      `https://api.github.com/repos/${accessibleProject.githubRepo}/issues`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Nuxt-MVP-App',
        },
        body: {
          title: result.data.title,
          body: result.data.description,
        },
      }
    )
  } catch (error) {
    const message =
      (error && typeof error === 'object' && 'data' in error && (error.data as { message?: string })?.message) ||
      (error instanceof Error ? error.message : 'Unknown error')
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to create GitHub issue: ${message}`,
    })
  }

  // 5. Store ticket in database linked with the GitHub issue number
  const created = db
    .insert(tickets)
    .values({
      ...result.data,
      userId: sessionUser.id,
      status: 'open',
      timestamp: new Date().toISOString(),
      githubIssueId: String(githubIssue.number),
    })
    .returning()
    .get()

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Unable to save ticket to database' })
  }

  setResponseStatus(event, 201)
  return created
})
