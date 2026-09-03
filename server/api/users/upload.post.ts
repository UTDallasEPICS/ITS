import path from 'path'
import fs from 'fs'
import { db } from '~~/server/utils/db'
import { user } from '~~/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireUser } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  // Auth is enforced by the gateway (server/middleware/auth.ts); requireUser
  // turns that guarantee into a typed, non-null user.
  const currentUser = requireUser(event)

  const form = await readMultipartFormData(event)

  if (!form) {
    throw createError({ statusCode: 400, statusMessage: 'No form data' })
  }

  const file = form.find((i) => i.name === 'file')

  if (!file || !file.data) {
    throw createError({ statusCode: 400, statusMessage: 'File missing' })
  }

  const dirPath = path.join(
    process.env.UPLOAD_STORAGE_PATH || 'public/images',
    'users',
    currentUser.id,
    'images'
  )

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }

  const randomImageId = crypto.randomUUID()

  const filePath = path.join(dirPath, randomImageId)

  if (fs.existsSync(filePath)) {
    throw createError({ statusCode: 400, message: 'Image already exists.' })
  }

  await fs.writeFile(filePath, file.data, (err) => {
    if (err) throw err
  })

  const imagePath = path.join('users', currentUser.id, 'images', randomImageId)

  const [updatedUser] = await db
    .update(user)
    .set({ image: imagePath, updatedAt: new Date() })
    .where(eq(user.id, currentUser.id))
    .returning()

  console.log(updatedUser)

  setResponseStatus(event, 201)

  return {
    message: 'Added profile picture to logged in user.',
  }
})
