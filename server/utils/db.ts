// The Neon Postgres connection, shared by every module that stores something:
// the pay-it-forward board and the webhook ledger.
//
// The URL comes from DATABASE_URL, or NETLIFY_DATABASE_URL where Netlify
// injects it — the second name outlived the host it was named for, and a
// deployment that still sets it keeps working.

import { neon as neonDirect, neonConfig, type NeonQueryFunction } from '@neondatabase/serverless'

export type Sql = NeonQueryFunction<false, false>

/** Where the connection string is read from, in order. */
function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL
}

// Lazy so the app can boot without the env var; the first API call that needs
// the database fails with an actionable message instead of a boot-time crash.
let _sql: Sql | null = null

export function db(): Sql {
  if (!_sql) {
    const url = databaseUrl()
    if (!url) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Database not configured',
        message: 'DATABASE_URL is not set. Point it at a Neon database (the hosting provider\'s dashboard issues one), or run the local stack — docker compose -f docker-compose.dev.yml up -d, then set DATABASE_URL + NEON_LOCAL_PROXY_ENDPOINT per .env.example.'
      })
    }

    // Local dev: point the Neon serverless HTTP driver at the proxy container
    // from docker-compose.dev.yml instead of a Neon cloud endpoint.
    //
    // `fetchEndpoint` is global config rather than a per-call `neon()` option,
    // so it is set here, beside the client it applies to. Unset in production,
    // where the driver talks to Neon itself.
    const localEndpoint = process.env.NEON_LOCAL_PROXY_ENDPOINT
    if (localEndpoint) neonConfig.fetchEndpoint = localEndpoint

    _sql = neonDirect(url)
  }
  return _sql
}
