import fs from 'node:fs'
import path from 'node:path'
import { fileTypeFromFile } from 'file-type'
import { db } from '../../../utils/db'
import { user } from '../../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // Auth is enforced by the gateway (server/middleware/auth.ts).
  const userId = getRouterParam(event, 'id')

  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing userId' })
  }

  const [record] = await db.select({ image: user.image }).from(user).where(eq(user.id, userId))

  const imagePath = record?.image

  const filePath = path.join(
    process.env.UPLOAD_STORAGE_PATH || 'public/images',
    imagePath || 'null'
  )

  if (!fs.existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found' })
  }

  // Files are stored without an extension, so detect the MIME type from the
  // file's magic bytes. Falls back to a generic type if detection fails.
  const detected = await fileTypeFromFile(filePath)
  setHeader(event, 'Content-Type', detected?.mime ?? 'application/octet-stream')

  const fileStream = fs.createReadStream(filePath)

  return sendStream(event, fileStream)
})
