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
  IdentityProvider,
  RequesterIdentity
} from '#shared/identity'
import { CHALLENGE_PROVIDERS, isDevOnlyProvider } from '#shared/identity'

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
  try {
    await issueProof(event, { ...identity, confirmation: 'control' }, email)
  } catch (err) {
    // Being full is not an error the reader made. They signed in, the provider
    // said yes, and the only problem is that they already have as many accounts
    // attached as a request may carry — so send them back to where they were,
    // where the page says so beside the accounts. Throwing here rendered a bare
    // 400 page instead, which loses their place and reads like a fault.
    if ((err as { data?: { limit?: boolean } })?.data?.limit) {
      return sendRedirect(event, withQuery(takeReturnTo(event), { verifyFull: '1' }))
    }
    throw err
  }
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
 * The same list in dev as in production, and it is now the whole of what the
 * site offers. A deployment with none configured cannot take requests at all and
 * says so plainly — which is the honest failure, and the one this site chooses.
 * It used to fall back to reading a named account, and then to simply believing
 * one; both let a request onto the board that nobody had proved anything about,
 * which is exactly what a sponsor was relying on us for.
 *
 * Two providers do not fit the clientId/clientSecret shape and both would be
 * silently dropped by a check that assumed it:
 *
 * - TikTok names its half of the pair `clientKey`. Asking the provider's own
 *   config what it is called is the difference between TikTok being offered and
 *   TikTok never appearing however carefully its credentials were filled in.
 * - Bluesky has no secret to hold. Its client is public and identified by the
 *   metadata document this site serves, so there is nothing to configure and
 *   nothing that can be left blank — it is always available, which is what
 *   keeps "no credentials anywhere" from meaning "no requests at all".
 */
const NO_CREDENTIALS_NEEDED = new Set<ChallengeProvider>(['bluesky'])

export function configuredProviders(event?: H3Event): ChallengeProvider[] {
  const oauth = useRuntimeConfig(event).oauth
  return CHALLENGE_PROVIDERS.filter((p) => {
    // The stand-in, and the gate that keeps it a stand-in. Note what this does
    // and does not do: `import.meta.dev` is false in a deployed build, so the
    // provider is never offered there — but its route still ships in the bundle
    // and is refused at runtime rather than absent. Verified against a real
    // production build: the list comes back without it and /verify/youface 404s.
    // See DEV_ONLY_PROVIDERS.
    if (isDevOnlyProvider(p)) return Boolean(import.meta.dev)
    if (NO_CREDENTIALS_NEEDED.has(p)) return true
    const config = oauth[p] as { clientId?: string, clientKey?: string, clientSecret?: string } | undefined
    return Boolean((config?.clientId || config?.clientKey) && config?.clientSecret)
  })
}
