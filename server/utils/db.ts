// The Netlify DB (Neon Postgres) connection, shared by every module that
// stores something: the pay-it-forward board and the webhook ledger.
//
// `neon()` reads NETLIFY_DATABASE_URL, which Netlify injects in production and
// `netlify dev` injects locally — run `netlify db init` once to provision it.

import { neon } from '@netlify/neon'
import { neon as neonDirect, neonConfig } from '@neondatabase/serverless'

export type Sql = ReturnType<typeof neon>

// Lazy so the app can boot without the env var; the first API call that needs
// the database fails with an actionable message instead of a boot-time crash.
let _sql: Sql | null = null

export function db(): Sql {
  if (!_sql) {
    if (!process.env.NETLIFY_DATABASE_URL) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Database not configured',
        message: 'NETLIFY_DATABASE_URL is not set. Either run the local stack (docker compose -f docker-compose.dev.yml up -d, then set NETLIFY_DATABASE_URL + NEON_LOCAL_PROXY_ENDPOINT per .env.example), or run `netlify db init` once and use `netlify dev` so the URL is injected.'
      })
    }

    // Local dev: point the Neon serverless HTTP driver at the proxy container
    // from docker-compose.dev.yml instead of a Neon cloud endpoint.
    //
    // `fetchEndpoint` is global-config only (not a per-call `neon()` option), and
    // @netlify/neon loads its own CJS copy of the driver — so setting the config
    // there wouldn't affect a client built from this ESM copy. Both the config and
    // the client therefore come from the same direct import in this branch.
    // Unset in production, where @netlify/neon talks to the real Netlify DB.
    const localEndpoint = process.env.NEON_LOCAL_PROXY_ENDPOINT
    if (localEndpoint) {
      neonConfig.fetchEndpoint = localEndpoint
      _sql = neonDirect(process.env.NETLIFY_DATABASE_URL) as Sql
    } else {
      _sql = neon()
    }
  }
  return _sql
}
