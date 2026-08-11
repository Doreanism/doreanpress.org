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
    // Transactional email (Brevo). When the key is missing, emails are logged
    // to the console instead of sent (mock mode).
    brevoApiKey: '',
    // Local capture: an SMTP URL (Mailpit, smtp://localhost:1025) takes
    // precedence over the API key, so dev never delivers to a real inbox.
    smtpUrl: '',
    // When true, Brevo requests carry `X-Sib-Sandbox: drop` — validated in full
    // by Brevo, then discarded. Lets a real key be exercised without delivering.
    brevoSandbox: 'false',
    fromEmail: 'Dorean Press <hello@doreanpress.org>',
    // Optional: notify the press when a new request is posted.
    pressEmail: '',
    // The sealed cookie. It carries two things with very different lifetimes:
    // completed identity challenges, which are evidence of a moment at a
    // provider and are worth twenty minutes, and a sign-in, which identifies an
    // inbox and is meant to last.
    //
    // `maxAge` is the longer of the two, so it can no longer be read as the
    // proof window — that is `PROOF_TTL_MS` in `server/utils/identityProof.ts`,
    // checked against each proof's own `verifiedAt`. Shortening this again would
    // not shorten a proof; lengthening it does not lengthen one either. Anything
    // stored here must state its own expiry rather than inherit this one.
    session: {
      name: 'dorean-identity-proof',
      maxAge: 60 * 60 * 24 * 30
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

  // Vite refuses requests whose Host header it does not recognise, which is what
  // stops a page on another site from driving this dev server through the
  // browser (DNS rebinding). A tunnel is exactly that shape seen from here: the
  // Host arrives as a trycloudflare.com name and every request 403s.
  //
  // Named as a suffix rather than `true` so the exemption is one throwaway
  // hostname family and not "any host at all" — the quick-tunnel name changes
  // every restart, so pinning the exact one would mean editing this file each
  // time. Dev-server only; `nuxt build` never reads it.
  //
  // Here to receive Lulu print-job webhooks against a local server. Delete it
  // once the callbacks are exercised somewhere with a real hostname.
  vite: {
    server: {
      allowedHosts: ['.trycloudflare.com']
    }
  },

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
