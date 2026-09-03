import 'dotenv/config'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'
import { env } from './env'

const connectionString = env.DATABASE_URL.replace('file:', '')

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle<typeof schema>> | undefined
}

export const db = globalForDb.db ?? drizzle(new Database(connectionString), { schema })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db
}
