// Shared plumbing for the identity challenge routes under `server/routes/verify/`.
//
// Each provider route is a thin adapter: it maps that provider's payload onto a
// RequesterIdentity and hands it to `completeChallenge`. Everything about where
// the reader came from and where they go back to lives here, so the three routes
// stay comparable at a glance.
//
// Nothing in here signs anybody in. The output is a proof that gets spent by
// whichever handler the reader was on their way to — see `identityProof.ts`.

import type { H3Event } from 'h3'
import { withQuery } from 'ufo'
import type { IdentityProvider, RequesterIdentity } from '#shared/identity'
import { CHALLENGE_PROVIDERS } from '#shared/identity'

/**
 * Holds the page the reader left, across the round trip to the provider. A
 * cookie rather than the OAuth `state` parameter because the providers differ
 * on what state they hand back, and nuxt-auth-utils already spends `state` on
 * CSRF for the providers that support it.
 */
const RETURN_COOKIE = 'dp-verify-return'

/** Only same-site paths. An open redirect here would lend our domain to a phish. */
function safePath(value: string | undefined | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

/**
 * Record where to come back to. Called on the outbound leg only — on the
 * callback the provider's query string has no `redirect` of ours in it, and
 * overwriting the cookie there would lose the destination.
 */
export function rememberReturnTo(event: H3Event) {
  setCookie(event, RETURN_COOKIE, safePath(String(getQuery(event).redirect || '')), {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    // Long enough to read a consent screen, short enough not to linger.
    maxAge: 600
  })
}

/**
 * Falls back to a `redirect` still on the query string, which covers the mock
 * route — it completes the challenge and returns within the one request, so the
 * cookie it would set is only a response header and can't be read back here.
 */
function takeReturnTo(event: H3Event): string {
  const value = getCookie(event, RETURN_COOKIE) || String(getQuery(event).redirect || '')
  deleteCookie(event, RETURN_COOKIE, { path: '/' })
  return safePath(value)
}

/**
 * Seal the completed challenge into the cookie and send the reader back.
 *
 * Stored under `proof`, never `user`: this is evidence for the action they were
 * in the middle of, not a session. The handler that action lands in spends it.
 */
export async function completeChallenge(
  event: H3Event,
  identity: Omit<RequesterIdentity, 'verifiedAt'>,
  email?: string
) {
  await setUserSession(event, {
    proof: {
      id: crypto.randomUUID(),
      identity: { ...identity, verifiedAt: new Date().toISOString() },
      email: email || undefined
    }
  })
  return sendRedirect(event, takeReturnTo(event))
}

/**
 * Send the reader back where they started with a flag the app turns into a
 * toast. The underlying error is logged, never shown — provider errors leak
 * client ids and internal URLs.
 */
export function challengeFailed(event: H3Event, provider: IdentityProvider, error: unknown) {
  console.error(`[verify] ${provider} challenge failed:`, error)
  return sendRedirect(event, withQuery(takeReturnTo(event), { verifyError: provider }))
}

/**
 * Providers that actually have credentials, so the UI never offers a button
 * that dead-ends on a configuration error. In dev the mock provider is always
 * offered as well; its route is compiled out of production builds.
 */
export function configuredProviders(event?: H3Event): IdentityProvider[] {
  const oauth = useRuntimeConfig(event).oauth
  const live = CHALLENGE_PROVIDERS.filter(p => oauth[p]?.clientId && oauth[p]?.clientSecret)
  return import.meta.dev ? [...live, 'mock' as const] : live
}
