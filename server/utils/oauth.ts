// Shared plumbing for the sign-in routes under `server/routes/auth/`.
//
// Each provider route is a thin adapter: it maps that provider's user payload
// onto a RequesterIdentity and hands it to `completeSignIn`. Everything about
// where the reader came from and where they go back to lives here, so the
// three routes stay comparable at a glance.

import type { H3Event } from 'h3'
import { withQuery } from 'ufo'
import type { IdentityProvider, RequesterIdentity } from '#shared/identity'
import { SIGN_IN_PROVIDERS } from '#shared/identity'

/**
 * Holds the page the reader left, across the round trip to the provider. A
 * cookie rather than the OAuth `state` parameter because the providers differ
 * on what state they hand back, and nuxt-auth-utils already spends `state` on
 * CSRF for the providers that support it.
 */
const RETURN_COOKIE = 'dp-auth-return'

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
 * route — it signs in and returns within the one request, so the cookie it
 * would set is only a response header and can't be read back here.
 */
function takeReturnTo(event: H3Event): string {
  const value = getCookie(event, RETURN_COOKIE) || String(getQuery(event).redirect || '')
  deleteCookie(event, RETURN_COOKIE, { path: '/' })
  return safePath(value)
}

/**
 * Seal the verified account into the session and send the reader back.
 *
 * `email` is kept beside the identity rather than inside it: the identity is
 * snapshotted onto public requests, and an email must never ride along.
 */
export async function completeSignIn(
  event: H3Event,
  identity: Omit<RequesterIdentity, 'verifiedAt'>,
  email?: string
) {
  await setUserSession(event, {
    user: {
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
export function signInFailed(event: H3Event, provider: IdentityProvider, error: unknown) {
  console.error(`[auth] ${provider} sign-in failed:`, error)
  return sendRedirect(event, withQuery(takeReturnTo(event), { authError: provider }))
}

/**
 * Providers that actually have credentials, so the UI never offers a button
 * that dead-ends on a configuration error. In dev the mock provider is always
 * offered as well; its route is compiled out of production builds.
 */
export function configuredProviders(event?: H3Event): IdentityProvider[] {
  const oauth = useRuntimeConfig(event).oauth
  const live = SIGN_IN_PROVIDERS.filter(p => oauth[p]?.clientId && oauth[p]?.clientSecret)
  return import.meta.dev ? [...live, 'mock' as const] : live
}
