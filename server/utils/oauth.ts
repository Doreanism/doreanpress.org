// Shared plumbing for the identity challenge routes under `server/routes/verify/`.
//
// Each provider route is a thin adapter: it maps that provider's payload onto a
// RequesterIdentity and hands it to `completeChallenge`. Everything about where
// the reader came from and where they go back to lives here, so the routes stay
// comparable at a glance.
//
// Nothing in here signs anybody in. The output is a proof that gets spent by
// whichever handler the reader was on their way to — see `identityProof.ts`.

import type { H3Event } from 'h3'
import { withQuery } from 'ufo'
import type {
  ChallengeProvider,
  ClaimProvider,
  IdentityProvider,
  LookupProvider,
  RequesterIdentity
} from '#shared/identity'
import { CHALLENGE_PROVIDERS, CLAIM_PROVIDERS, LOOKUP_PROVIDERS } from '#shared/identity'

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
 * Falls back to a `redirect` still on the query string, for a provider that
 * hands the reader back before the outbound leg's cookie is readable.
 */
function takeReturnTo(event: H3Event): string {
  const value = getCookie(event, RETURN_COOKIE) || String(getQuery(event).redirect || '')
  deleteCookie(event, RETURN_COOKIE, { path: '/' })
  return safePath(value)
}

/**
 * Seal the completed challenge into the cookie and send the reader back.
 *
 * `confirmation` is stamped here rather than passed in, and that is the point:
 * everything reaching this function came back from a provider that signed the
 * reader in, so control is established by construction and no adapter can
 * accidentally claim it for something weaker.
 */
export async function completeChallenge(
  event: H3Event,
  identity: Omit<RequesterIdentity, 'verifiedAt' | 'confirmation'>,
  email?: string
) {
  await issueProof(event, { ...identity, confirmation: 'control' }, email)
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
 * that dead-ends on a configuration error.
 *
 * The same list in dev as in production. A deployment with none configured
 * cannot take requests at all, and says so rather than falling back to
 * something that would let anyone through.
 *
 * TikTok names its half of the pair `clientKey`, not `clientId` — so the check
 * asks the provider's own config what it is called rather than assuming, which
 * is the difference between TikTok being offered and TikTok silently never
 * appearing however carefully its credentials were filled in.
 */
export function configuredProviders(event?: H3Event): ChallengeProvider[] {
  const oauth = useRuntimeConfig(event).oauth
  return CHALLENGE_PROVIDERS.filter((p) => {
    const config = oauth[p] as { clientId?: string, clientKey?: string, clientSecret?: string } | undefined
    return Boolean((config?.clientId || config?.clientKey) && config?.clientSecret)
  })
}

/**
 * Lookup providers this deployment actually offers.
 *
 * Everything on the list, less anything that can be signed into here. See
 * `isChallengeProvider` in `#shared/identity` for why the stronger route
 * withdraws the weaker one rather than sitting beside it.
 */
export function offeredLookupProviders(event?: H3Event): LookupProvider[] {
  const challenge = new Set<string>(configuredProviders(event))
  return LOOKUP_PROVIDERS.filter(p => !challenge.has(p))
}

/**
 * Claimable providers this deployment actually offers.
 *
 * The same subtraction one rung down, and together the three functions state
 * the whole rule: **every provider is offered by the strongest route available
 * for it here, and by no other.** Sign-in where there are credentials;
 * otherwise a lookup where the provider has a public API; otherwise, and only
 * otherwise, the reader's unchecked word.
 *
 * `CLAIM_PROVIDERS` already excludes everything with a lookup API, so the only
 * subtraction left is the configured challenges. Configure X and the option to
 * merely claim an X account disappears the same moment the button appears.
 */
export function offeredClaimProviders(event?: H3Event): ClaimProvider[] {
  const challenge = new Set<string>(configuredProviders(event))
  return CLAIM_PROVIDERS.filter(p => !challenge.has(p))
}
