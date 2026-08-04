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
    //
    // Each is optional and a provider with no credentials simply isn't offered.
    // There is no fallback beneath them any more: a deployment that configures
    // none of these can take no requests, and says so, rather than accepting an
    // account nobody proved anything about. Bluesky is the exception that keeps
    // that from being a cliff — see below.
    oauth: {
      x: { clientId: '', clientSecret: '' },
      facebook: { clientId: '', clientSecret: '' },
      linkedin: { clientId: '', clientSecret: '' },
      github: { clientId: '', clientSecret: '' },
      gitlab: { clientId: '', clientSecret: '' },
      twitch: { clientId: '', clientSecret: '' },
      // `clientKey`, not `clientId` — TikTok's own name for it, and what
      // nuxt-auth-utils reads. `configuredProviders` accepts either.
      tiktok: { clientKey: '', clientSecret: '' },
      // Bluesky needs no credentials at all, and that is a property of atproto
      // rather than an oversight: the client is public, identified by a metadata
      // document served from this site (`/bluesky/client-metadata.json`, added
      // by `auth.atproto` below) instead of by a secret. So it is always
      // offered, and it is the reason a deployment with no OAuth apps
      // registered anywhere can still accept requests — from readers who have a
      // Bluesky account, proved as strongly as any of the others.
      bluesky: {
        clientName: 'Dorean Press',
        redirectUris: ['/verify/bluesky'],
        // Needed for the profile itself. Without it the callback carries a DID
        // and nothing else — no name, no handle, no avatar — and a sponsor
        // would be shown an opaque identifier to judge.
        scope: ['transition:generic']
      }
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

  // Serves the atproto client-metadata document and registers the Bluesky
  // handler. Without it `defineOAuthBlueskyEventHandler` is not imported and the
  // metadata URL 404s, which reads at the provider as a misconfigured client.
  auth: {
    atproto: true
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
