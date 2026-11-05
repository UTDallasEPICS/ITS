// Public endpoint: lets the embeddable widget submit a ticket without a session.
export default defineEventHandler(async () => {
  return { ok: true }
})
