// Enable CORS only for API routes the widget calls from other origins.
// All other routes are left untouched.

const WIDGET_PATHS = ['/api/health', '/api/widget/']

export default defineEventHandler((event) => {
  const isWidgetPath = WIDGET_PATHS.some((p) => event.path.startsWith(p))
  if (!isWidgetPath) return

  handleCors(event, {
    origin: '*', // widget requests are credential-less; narrow per site tag later
    methods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
})
