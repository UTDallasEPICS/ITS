import { defineVitestConfig } from '@nuxt/test-utils/config'

// Vitest baseline for the template. Tests run in the Nuxt environment so they
// can render real components with auto-imports, NuxtLink, and Nuxt UI, but they
// never start a server or touch a database — see docs/testing.md.
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['tests/nuxt/**/*.test.ts'],
    // Fail the run if no tests are found, so an empty/broken suite can never
    // pass silently in a merge request.
    passWithNoTests: false,
  },
})
