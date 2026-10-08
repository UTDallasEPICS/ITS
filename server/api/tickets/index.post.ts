import { defineEventHandler, readBody, createError } from 'h3'

interface TicketRequest {
  title: string
  body: string
  projectID: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<TicketRequest>(event)

  // 1. Backend Validation
  if (!body || !body.title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Title field is required.'
    })
  }

  try {

    // 3. Dispatch data securely to GitHub REST API
    const githubResponse = await $fetch(`https://api.github.com/repos/${process.env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Nuxt-MVP-App' // GitHub requires a user-agent header
      },
      body: {
        title: body.title,
        body: body.body || ''
      }
    })

    return { success: true, githubData: githubResponse }

  } catch (error: any) {
    // Gracefully catch database or network connection dropouts
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to register issue: ${error.message}`
    })
  }
})
