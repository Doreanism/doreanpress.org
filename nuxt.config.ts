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
    // Transactional email (Resend). When the key is missing, emails are logged
    // to the console instead of sent (mock mode).
    resendApiKey: '',
    fromEmail: 'Dorean Press <hello@doreanpress.org>',
    // Optional: notify the press when a new request is posted.
    pressEmail: '',
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

  // Datastore for pay-it-forward book requests. On Netlify the filesystem is
  // ephemeral/read-only, so use Netlify Blobs there; everything else (local
  // dev, `nuxt preview`) uses a file driver. Swap drivers without touching the
  // server/utils/requests.ts interface.
  nitro: {
    storage: {
      db: process.env.NETLIFY
        ? { driver: 'netlifyBlobs', name: 'db' }
        : { driver: 'fs', base: './.data/db' }
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
