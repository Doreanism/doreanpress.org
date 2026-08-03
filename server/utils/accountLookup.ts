// Looking up a public account the reader has named.
//
// The reader types an account, we fetch its public profile, and if it is really
// there they may post a request. What this establishes is `existence` and not
// `control` — see `Confirmation` in `#shared/identity`, and read that comment
// before changing anything here, because every copy decision downstream depends
// on this route being honest about which of the two it did.
//
// Only providers that genuinely permit it are here. Each serves a documented,
// unauthenticated, read-only profile endpoint and distinguishes "no such
// account" from every other failure — which is the whole requirement, and the
// reason X, Facebook and LinkedIn cannot be added (see LOOKUP_PROVIDERS).
//
// How a provider says "no such account" is not uniform, and getting it wrong
// breaks rule 1 below in the direction that matters. GitHub and Mastodon answer
// 404; Bluesky answers 400; GitLab answers *200 with an empty list*, so there the
// absence is in the body and reading only the status code would report every
// unknown handle as found.
//
// Three rules hold for every adapter below:
//
//  1. Only "definitely not there" may read as not-found. A timeout, a 500 or a
//     rate-limit is *unknown*, and must not be reported to the reader as "that
//     account doesn't exist" — that would turn somebody's bad afternoon into
//     being told they made their own account up.
//  2. Nothing the reader typed reaches a URL unencoded, and no adapter follows
//     a redirect to a host it did not choose.
//  3. Every call is bounded in time and in size. These are third-party hosts on
//     the request path of a form the reader is waiting on.

import {
  IDENTITY_PROVIDERS,
  LOOKUP_PROVIDERS,
  type IdentityProvider,
  type LookupProvider,
  type RequesterIdentity
} from '#shared/identity'

/** Bounded so a slow provider cannot hold a request open indefinitely. */
const TIMEOUT_MS = 6000

/** Sent on every call: GitHub requires one, and the rest deserve the courtesy. */
const USER_AGENT = 'doreanpress.org (+https://doreanpress.org)'

/**
 * What a lookup concluded.
 *
 * `unknown` is a genuinely different answer from `missing` and is kept separate
 * all the way to the reader — see rule 1 above.
 */
export type LookupOutcome
  = | { status: 'found', identity: Omit<RequesterIdentity, 'verifiedAt'> }
    | { status: 'missing' }
    | { status: 'unsupported' }
    | { status: 'unknown', reason: string }

export function isLookupProvider(value: string): value is LookupProvider {
  return (LOOKUP_PROVIDERS as string[]).includes(value)
}

/** A reader pastes what they have; take the account out of whatever that was. */
export function normalizeAccount(provider: IdentityProvider, raw: string): string {
  let value = raw.trim()

  // A profile URL is the likeliest paste, and its last path segment is the
  // account on most providers. Parsed rather than pattern-matched so a query
  // string or a trailing slash doesn't end up inside the handle.
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value)
      const segments = url.pathname.split('/').filter(Boolean)
      const last = segments[segments.length - 1] ?? ''

      if (provider === 'mastodon' && last.startsWith('@')) {
        // A Mastodon profile is https://server/@user, and the server is the
        // half that says which Mastodon this is — it cannot be dropped.
        value = `${last.slice(1)}@${url.hostname}`
      } else {
        value = last
      }
    } catch {
      // Not a URL after all; fall through and treat it as typed.
    }
  }

  return value.replace(/^@+/, '').trim().slice(0, 200)
}

/** One fetch, bounded, never following a redirect off the host we chose. */
async function readJson(url: string): Promise<{ ok: true, body: unknown } | { ok: false, status: number | null, reason: string }> {
  try {
    const response = await fetch(url, {
      headers: { 'accept': 'application/json', 'user-agent': USER_AGENT },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })

    if (!response.ok) {
      return { ok: false, status: response.status, reason: `HTTP ${response.status}` }
    }
    return { ok: true, body: await response.json() }
  } catch (error) {
    return { ok: false, status: null, reason: error instanceof Error ? error.message : 'request failed' }
  }
}

/** GitHub: `GET /users/:login`, 404 for no such user. Public and unauthenticated. */
async function lookupGithub(account: string): Promise<LookupOutcome> {
  if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(account)) return { status: 'missing' }

  const result = await readJson(`https://api.github.com/users/${encodeURIComponent(account)}`)
  if (!result.ok) {
    return result.status === 404 ? { status: 'missing' } : { status: 'unknown', reason: result.reason }
  }

  const user = result.body as {
    id?: number
    login?: string
    name?: string
    avatar_url?: string
    html_url?: string
    created_at?: string
    type?: string
  }
  // An organisation is an account, but it is not a person waiting for a book.
  if (!user?.id || !user.login || (user.type && user.type !== 'User')) return { status: 'missing' }

  return {
    status: 'found',
    identity: {
      provider: 'github',
      confirmation: 'existence',
      subject: String(user.id),
      name: user.name || user.login,
      handle: user.login,
      profileUrl: user.html_url || `https://github.com/${user.login}`,
      avatarUrl: user.avatar_url,
      accountCreatedAt: user.created_at
    }
  }
}

/** Bluesky: the public AppView needs no auth; a bad actor is a 400. */
async function lookupBluesky(account: string): Promise<LookupOutcome> {
  if (!/^[a-z\d][a-z\d.-]{0,252}[a-z\d]$/i.test(account) || !account.includes('.')) {
    return { status: 'missing' }
  }

  const result = await readJson(
    `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(account)}`
  )
  if (!result.ok) {
    return result.status === 400 || result.status === 404
      ? { status: 'missing' }
      : { status: 'unknown', reason: result.reason }
  }

  const user = result.body as {
    did?: string
    handle?: string
    displayName?: string
    avatar?: string
    createdAt?: string
  }
  // A deleted account can still resolve to a handle-shaped placeholder.
  if (!user?.did || !user.handle || user.handle === 'handle.invalid') return { status: 'missing' }

  return {
    status: 'found',
    identity: {
      provider: 'bluesky',
      confirmation: 'existence',
      // The DID is the account; the handle is a rented name pointing at it.
      subject: user.did,
      name: user.displayName || user.handle,
      handle: user.handle,
      profileUrl: `https://bsky.app/profile/${encodeURIComponent(user.handle)}`,
      avatarUrl: user.avatar,
      accountCreatedAt: user.createdAt
    }
  }
}

/**
 * Whether a Mastodon server is one we are willing to call.
 *
 * Mastodon is the only provider here whose *host* comes from the reader, which
 * makes this the one lookup that could be pointed anywhere — at metadata
 * services, at machines inside our own network, at localhost. So the host must
 * look like a public domain name and nothing else: a name with a dot and a
 * real TLD, never bare hostnames, never anything that parses as an IP address.
 */
function isAllowedMastodonHost(host: string): boolean {
  if (!/^[a-z\d]([a-z\d-]*[a-z\d])?(\.[a-z\d]([a-z\d-]*[a-z\d])?)+$/i.test(host)) return false
  if (host.length > 253) return false
  // A dotted-quad passes the shape test above, and 127.0.0.1 is exactly what
  // this exists to refuse. Anything whose last label is numeric is not a domain.
  if (/^[\d.]+$/.test(host)) return false
  if (/\.(local|localhost|internal|home|lan|test|example|invalid)$/i.test(host)) return false
  return host.toLowerCase() !== 'localhost'
}

/** Mastodon: `user@server`, looked up on that server's own public API. */
async function lookupMastodon(account: string): Promise<LookupOutcome> {
  const [user, host, ...rest] = account.split('@')
  if (!user || !host || rest.length > 0) return { status: 'missing' }
  if (!/^[\w.-]{1,64}$/.test(user)) return { status: 'missing' }
  if (!isAllowedMastodonHost(host)) return { status: 'missing' }

  const result = await readJson(
    `https://${host}/api/v1/accounts/lookup?acct=${encodeURIComponent(user)}`
  )
  if (!result.ok) {
    return result.status === 404 || result.status === 410
      ? { status: 'missing' }
      : { status: 'unknown', reason: result.reason }
  }

  const found = result.body as {
    id?: string
    username?: string
    acct?: string
    display_name?: string
    avatar?: string
    url?: string
    created_at?: string
    suspended?: boolean
  }
  if (!found?.id || !found.username || found.suspended) return { status: 'missing' }

  // The id is only unique within its server, so the server is part of the key.
  const address = `${found.username}@${host}`
  return {
    status: 'found',
    identity: {
      provider: 'mastodon',
      confirmation: 'existence',
      subject: `${host}:${found.id}`,
      name: found.display_name || found.username,
      handle: address,
      profileUrl: found.url || `https://${host}/@${encodeURIComponent(found.username)}`,
      avatarUrl: found.avatar,
      accountCreatedAt: found.created_at
    }
  }
}

/** GitLab: a public user search, and no such user is an empty list on a 200. */
async function lookupGitlab(account: string): Promise<LookupOutcome> {
  if (!/^[a-z\d][a-z\d._-]{0,254}$/i.test(account)) return { status: 'missing' }

  const result = await readJson(
    `https://gitlab.com/api/v4/users?username=${encodeURIComponent(account)}`
  )
  if (!result.ok) {
    return result.status === 404 ? { status: 'missing' } : { status: 'unknown', reason: result.reason }
  }

  const [user] = (Array.isArray(result.body) ? result.body : []) as {
    id?: number
    username?: string
    name?: string
    avatar_url?: string
    web_url?: string
    state?: string
  }[]
  // The absence is in the body here, not the status — see the header note.
  if (!user?.id || !user.username) return { status: 'missing' }
  if (user.state && user.state !== 'active') return { status: 'missing' }

  return {
    status: 'found',
    identity: {
      provider: 'gitlab',
      confirmation: 'existence',
      subject: String(user.id),
      name: user.name || user.username,
      handle: user.username,
      profileUrl: user.web_url || `https://gitlab.com/${encodeURIComponent(user.username)}`,
      avatarUrl: user.avatar_url
      // No `accountCreatedAt`: GitLab returns `created_at` only to an
      // authenticated caller, and calling unauthenticated is the whole point.
      // The badge simply omits the age rather than inventing one.
    }
  }
}

/**
 * Find the account the reader named, on the provider they named it at.
 *
 * Returns the identity to show them, or why we could not — which the caller
 * must relay faithfully, `missing` and `unknown` being different things to be
 * told about your own account.
 */
export async function lookupAccount(provider: string, raw: string): Promise<LookupOutcome> {
  if (!isLookupProvider(provider)) return { status: 'unsupported' }

  const account = normalizeAccount(provider, raw)
  if (!account) return { status: 'missing' }

  switch (provider) {
    case 'github': return lookupGithub(account)
    case 'bluesky': return lookupBluesky(account)
    case 'mastodon': return lookupMastodon(account)
    case 'gitlab': return lookupGitlab(account)
    default: return { status: 'unsupported' }
  }
}

/** What to put in the field's placeholder, from the provider table. */
export function accountExample(provider: IdentityProvider): string {
  return IDENTITY_PROVIDERS[provider]?.accountExample ?? ''
}
