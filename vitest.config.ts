import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests only, over pure functions — the `shared/` modules, plus the server
// helpers that touch neither the database nor an event. None of them need a Nuxt
// test environment. Anything needing a running server or a database is not
// covered here.
//
// The `#shared` alias is Nuxt's; it is repeated here so a server module can be
// imported straight from a test.
export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url))
    }
  },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node'
  }
})
