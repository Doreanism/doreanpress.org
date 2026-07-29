// The public account behind a book request.
//
// Anyone can type a name into a form, so a reader asking for a free book first
// proves they hold a public account, and that account is shown on the board. The
// claim this makes is deliberately narrow: not that a provider vouches for
// anyone's character, but that a real account with a visible history costs
// something to build and is cheap for a sponsor to go look at. We surface the
// signals; the sponsor decides. Nothing here should ever be phrased as us
// certifying a person.
//
// This is a challenge, not a membership: see IdentityProof below.
//
// Imported by both the app and the Nitro server through the `#shared` alias, so
// the board, the request form and the notification emails all describe an
// account the same way.

export type IdentityProvider = 'x' | 'facebook' | 'linkedin' | 'mock'

export interface RequesterIdentity {
  provider: IdentityProvider
  /**
   * The provider's own id for the account. Public, not an email: X exposes it
   * anyway, Facebook's is scoped to this app, LinkedIn's is opaque. Paired with
   * `provider` it identifies the account across requests.
   */
  subject: string
  /** Display name exactly as the provider gives it. */
  name: string
  /** Public handle, where the provider has one (X's @username). */
  handle?: string
  /** A profile a sponsor can open. Only some providers expose one — see below. */
  profileUrl?: string
  /** Avatar on the provider's CDN. These expire, so always allow a fallback. */
  avatarUrl?: string
  /** The provider's own verified badge, not ours. */
  providerVerified?: boolean
  /** When the reader last proved they hold the account. */
  verifiedAt: string
}

/**
 * A completed identity challenge.
 *
 * Evidence that whoever holds it controlled `identity` at `verifiedAt` — and
 * nothing more. It is deliberately not a login: it is raised for one action,
 * stamped onto that action, and spent. There are no accounts on this site, no
 * signed-in state, and nothing to sign out of.
 */
export interface IdentityProof {
  /**
   * Unique to this proof, and recorded server-side once it is spent.
   *
   * Without it, spending would be advisory: clearing a cookie only asks the
   * browser to forget it, and a copy kept anywhere else would still be a
   * perfectly valid sealed value until it expired.
   */
  id: string
  identity: RequesterIdentity
  /**
   * Address the provider handed us. Held beside the identity rather than inside
   * it, so it can never ride along to the public board — it exists only to
   * prefill the reader's own form.
   */
  email?: string
}

export interface ProviderMeta {
  label: string
  icon: string
  /**
   * Whether the provider hands us a public profile URL. X does. Facebook's
   * `user_link` and LinkedIn's vanity name both sit behind partner review, so
   * those accounts show as a verified name and photo with nothing to click.
   */
  linkable: boolean
  /** Dev-only providers never appear in a production build. */
  devOnly?: boolean
}

export const IDENTITY_PROVIDERS: Record<IdentityProvider, ProviderMeta> = {
  x: { label: 'X', icon: 'i-simple-icons-x', linkable: true },
  facebook: { label: 'Facebook', icon: 'i-simple-icons-facebook', linkable: false },
  linkedin: { label: 'LinkedIn', icon: 'i-simple-icons-linkedin', linkable: false },
  mock: { label: 'Test account', icon: 'i-lucide-flask-conical', linkable: false, devOnly: true }
}

/** A real provider — everything except the dev-only stand-in. */
export type ChallengeProvider = Exclude<IdentityProvider, 'mock'>

/** The providers a reader may prove an account with, in the order offered. */
export const CHALLENGE_PROVIDERS: ChallengeProvider[] = ['x', 'facebook', 'linkedin']

export function providerLabel(provider: IdentityProvider): string {
  return IDENTITY_PROVIDERS[provider]?.label ?? provider
}

export function providerIcon(provider: IdentityProvider): string {
  return IDENTITY_PROVIDERS[provider]?.icon ?? 'i-lucide-user'
}

/** Stable key for one account, used for ownership and per-account limits. */
export function accountKey(identity: Pick<RequesterIdentity, 'provider' | 'subject'>): string {
  return `${identity.provider}:${identity.subject}`
}

export function isSameAccount(
  a: Pick<RequesterIdentity, 'provider' | 'subject'> | null | undefined,
  b: Pick<RequesterIdentity, 'provider' | 'subject'> | null | undefined
): boolean {
  return Boolean(a && b && accountKey(a) === accountKey(b))
}

/** One-line description for emails and logs: 'Jane Doe (@jane on X)'. */
export function describeIdentity(identity: RequesterIdentity | null | undefined): string {
  if (!identity) return 'unverified'
  const label = providerLabel(identity.provider)
  return identity.handle
    ? `${identity.name} (@${identity.handle} on ${label})`
    : `${identity.name} (${label})`
}
