import 'dotenv/config'
import { z } from 'zod'

// Environment variables the app needs to run. Validated once, on import, so a
// missing/blank value fails fast with a clear message at startup instead of
// surfacing as a confusing error deep inside the database, auth, or email later.
//
// This lives in a module that db.ts and auth.ts import, rather than a Nitro
// plugin, because db.ts reads DATABASE_URL at module load — earlier than any
// plugin runs — so the plugin would never get a chance to report the problem.
//
// UPLOAD_STORAGE_PATH is intentionally omitted: it has a safe code default.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  EMAIL_HOST: z.string().min(1),
  EMAIL_USER: z.string().min(1),
  EMAIL_PASS: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
})

export type Env = z.infer<typeof envSchema>

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `Invalid environment configuration:\n${details}\n\n` +
        `Copy .env.example to .env and set the required values before starting the app.`
    )
  }

  return result.data
}

// Skip validation under Vitest, which runs without a real environment and does
// not exercise the code paths that need these variables.
export const env: Env = process.env.VITEST ? (process.env as unknown as Env) : validateEnv()
