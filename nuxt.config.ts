import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  hooks: {
    'pages:extend'(pages) {
      if (process.env.NODE_ENV === 'development') {
        pages.push({
          name: 'chat-playground',
          path: '/dev/chat',
          file: fileURLToPath(new URL('./app/dev/chat-playground.vue', import.meta.url)),
        })
      }
    },
  },
  modules: ['@nuxt/ui', '@nuxt/image', '@nuxt/eslint'],
  css: ['./assets/css/main.css'],
  // Prettier owns formatting; ESLint handles logic only (no stylistic rules).
  eslint: {
    config: {
      stylistic: false,
    },
  },
  // Surface TypeScript errors in the terminal during `nuxt dev`. Not during
  // `nuxt build`: the in-build vue-tsc runs in a clean environment where it
  // can't resolve auto-imports/module types and fails the Docker deploy. CI
  // runs `pnpm typecheck` (nuxi typecheck) as the real gate.
  typescript: {
    typeCheck: process.env.NODE_ENV !== 'production',
  },
  nitro: {
    experimental: {
      websocket: true,
    },
  },
  vite: {
    optimizeDeps: {
      include: ['better-auth/client/plugins', 'better-auth/vue', 'zod'],
    },
  },
})
