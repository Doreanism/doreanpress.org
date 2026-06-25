// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  // Server-only secrets + public config. Override in production with
  // NUXT_*-prefixed environment variables (see .env.example).
  runtimeConfig: {
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    lulu: {
      clientKey: '',
      clientSecret: '',
      baseUrl: 'https://api.sandbox.lulu.com',
      contactEmail: '',
      // When true (or when credentials are missing) the Lulu client returns
      // mocked responses so the site works without real keys.
      mock: 'true'
    },
    public: {
      siteUrl: 'http://localhost:3000',
      stripePublishableKey: ''
    }
  },

  routeRules: {
    '/': { prerender: true },
    '/about': { prerender: true }
  },

  compatibilityDate: '2025-01-15',

  // File-backed datastore for pay-it-forward book requests. Swap the driver
  // (e.g. for Postgres/SQLite/KV) without touching the server/utils/requests.ts
  // interface.
  nitro: {
    storage: {
      db: { driver: 'fs', base: './.data/db' }
    },
    devStorage: {
      db: { driver: 'fs', base: './.data/db' }
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
