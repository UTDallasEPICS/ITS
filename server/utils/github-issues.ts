import { createError } from 'h3'

type GitHubIssueResponse = {
  id: number
  number: number
  html_url: string
}

/** Creates an issue in the project repository and returns its number. */
export async function createGitHubIssue(repo: string, title: string, description: string) {
  try {
    const issue = await $fetch<GitHubIssueResponse>(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Nuxt-MVP-App',
      },
      body: { title, body: description },
    })

    return String(issue.number)
  } catch (error) {
    let message = error instanceof Error ? error.message : 'Unknown error'
    if (error && typeof error === 'object' && 'data' in error) {
      const data = error.data
      if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
        message = data.message
      }
    }

    throw createError({
      statusCode: 502,
      statusMessage: `Failed to create GitHub issue: ${message}`,
    })
  }
}
