export default defineEventHandler((event) => {
  setResponseStatus(event, 200)
  return {
      timestamp: Date.now()
  }
})
