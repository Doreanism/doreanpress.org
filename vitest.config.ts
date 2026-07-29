import { defineConfig } from 'vitest/config'

// Unit tests only, over the `shared/` modules — which are deliberately free of
// Nuxt imports, so they need no Nuxt test environment to exercise. Anything
// needing a running server or a database is not covered here.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node'
  }
})
