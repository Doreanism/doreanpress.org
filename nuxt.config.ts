// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    'nuxt-auth-utils'
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
    // The sealed cookie holding a completed identity challenge. Short-lived on
    // purpose: it is not a login, only a proof that has to survive the redirect
    // back from the provider and then the minute or two it takes to fill in an
    // address. The server clears it as soon as the action it was raised for
    // lands, so this window is a backstop, not the normal lifetime.
    session: {
      name: 'dorean-identity-proof',
      maxAge: 60 * 20
    },
    // Public accounts a reader can prove they hold in order to post a free-book
    // request.
    // Each is optional: a provider with no credentials simply isn't offered, so
    // the site runs with one, some or all of them — or none, in which case
    // readers fall back to naming a public account we look up instead (no
    // credentials, and a weaker claim, which the site states plainly). No
    // stand-in anywhere.
    // Configuring GitHub here withdraws GitHub from the lookup list, since the
    // same account can then be proved rather than merely named.
    oauth: {
      x: { clientId: '', clientSecret: '' },
      facebook: { clientId: '', clientSecret: '' },
      linkedin: { clientId: '', clientSecret: '' },
      github: { clientId: '', clientSecret: '' },
      twitch: { clientId: '', clientSecret: '' },
      // `clientKey`, not `clientId` — TikTok's own name for it, and what
      // nuxt-auth-utils reads. `configuredProviders` accepts either.
      tiktok: { clientKey: '', clientSecret: '' }
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

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
