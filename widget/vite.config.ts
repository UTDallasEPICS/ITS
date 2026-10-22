import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Builds the embeddable widget into ONE self-contained script.
// Output lands in public/, so Nuxt serves it at /widget/v1/its-widget.js
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [
    vue({
      // Compile every SFC (including shared ones imported from app/) in
      // custom-element mode so their <style> is injected into the shadow root
      features: { customElement: true },
    }),
  ],
  // Library builds don't replace this automatically; Vue needs it
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: fileURLToPath(new URL('../public/widget/v1', import.meta.url)),
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/main.ts', import.meta.url)),
      name: 'ITSWidget',
      formats: ['iife'],
      fileName: () => 'its-widget.js',
    },
  },
})
