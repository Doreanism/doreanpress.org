// The public account behind a book request.
//
// Anyone can type a name into a form, so a reader asking for a free book puts a
// public account behind it, and that account is shown on the board. The claim
// this makes is deliberately narrow: not that a provider vouches for anyone's
// character, but that a real account with a visible history costs something to
// build and is cheap for a sponsor to go look at. We surface the signals; the
// sponsor decides. Nothing here should ever be phrased as us certifying a
// person.
//
// This is a challenge, not a membership: see IdentityProof below.
//
// Imported by both the app and the Nitro server through the `#shared` alias, so
// the board, the request form and the notification emails all describe an
// account the same way.

export type IdentityProvider = 'x' | 'facebook' | 'linkedin' | 'github' | 'bluesky' | 'mastodon'

/**
 * What a completed check actually establishes. The single most important
 * distinction in this file — everything a sponsor is shown depends on it.
 *
 * - `control` — the reader went to the provider, signed in, and the provider
 *   told us who they are. They *are* this account.
 * - `existence` — the reader typed an account and we fetched its public profile.
 *   The account is real and looks as described; whether the reader is the person
 *   holding it is not established, and must never be implied.
 *
 * `existence` is the weaker of the two in a specific, load-bearing way: handles
 * are free to type, so it neither prevents impersonation nor makes a second
 * posting cost anything. Rules that lean on scarcity have to bite somewhere else
 * for these — see the doorstep check in `POST /api/requests`.
 */
export type Confirmation = 'control' | 'existence'

export interface RequesterIdentity {
  provider: IdentityProvider
  /**
   * What was actually checked. Never assume: an identity that reached us by
   * lookup carries exactly the same shape as one that reached us by challenge,
   * and only this field tells them apart.
   */
  confirmation: Confirmation
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
  /**
   * When the account itself was opened, where the provider says so.
   *
   * Carried for the sponsor's benefit, and it matters most exactly where the
   * evidence is weakest: an `existence` check cannot say the reader is this
   * person, but a ten-year-old account is still a far better thing to be shown
   * than one opened this morning.
   */
  accountCreatedAt?: string
  /** When this account was last checked, by whichever route. */
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
  /** The strongest thing this provider can be made to establish here. */
  confirms: Confirmation
  /** For lookup providers: what the reader is being asked to type. */
  accountHint?: string
  /** For lookup providers: a example of the shape, shown in the field. */
  accountExample?: string
}

export const IDENTITY_PROVIDERS: Record<IdentityProvider, ProviderMeta> = {
  x: { label: 'X', icon: 'i-simple-icons-x', linkable: true, confirms: 'control' },
  facebook: { label: 'Facebook', icon: 'i-simple-icons-facebook', linkable: false, confirms: 'control' },
  linkedin: { label: 'LinkedIn', icon: 'i-simple-icons-linkedin', linkable: false, confirms: 'control' },
  github: {
    label: 'GitHub',
    icon: 'i-simple-icons-github',
    linkable: true,
    confirms: 'existence',
    accountHint: 'username',
    accountExample: 'torvalds'
  },
  bluesky: {
    label: 'Bluesky',
    icon: 'i-simple-icons-bluesky',
    linkable: true,
    confirms: 'existence',
    accountHint: 'handle',
    accountExample: 'alice.bsky.social'
  },
  mastodon: {
    label: 'Mastodon',
    icon: 'i-simple-icons-mastodon',
    linkable: true,
    confirms: 'existence',
    accountHint: 'full address, including the server',
    accountExample: 'alice@mastodon.social'
  }
}

/**
 * Providers a reader proves *control* of, by going there and coming back.
 *
 * Every one is a real round trip, in dev exactly as in production. There is
 * deliberately no stand-in: a challenge that can be satisfied without an account
 * is not a challenge, and one that behaves differently on a developer's machine
 * is not the thing being tested.
 */
export type ChallengeProvider = Extract<IdentityProvider, 'x' | 'facebook' | 'linkedin'>

export const CHALLENGE_PROVIDERS: ChallengeProvider[] = ['x', 'facebook', 'linkedin']

/**
 * Providers whose accounts a reader can simply *name*, for us to go and read.
 *
 * These three are here because they are the ones that actually allow it: each
 * serves a public profile over a documented, unauthenticated API and answers
 * "no such account" distinguishably. X, Facebook and LinkedIn are absent from
 * this list and cannot join it — Facebook removed username lookup from the Graph
 * API, LinkedIn has no public profile API at all, and X's requires a paid bearer
 * token. Reading their HTML instead would be scraping: against their terms,
 * blocked from server IPs, and broken by the next markup change. If one of them
 * ever needs to be offered this way, it needs credentials and a real client, not
 * a page fetch.
 */
export type LookupProvider = Extract<IdentityProvider, 'github' | 'bluesky' | 'mastodon'>

export const LOOKUP_PROVIDERS: LookupProvider[] = ['github', 'bluesky', 'mastodon']

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

export function providerConfirms(provider: IdentityProvider): Confirmation {
  return IDENTITY_PROVIDERS[provider]?.confirms ?? 'existence'
}

/** Whether this account was proved, rather than merely named and read. */
export function isControlConfirmed(
  identity: Pick<RequesterIdentity, 'confirmation'> | null | undefined
): boolean {
  return identity?.confirmation === 'control'
}

/**
 * The claim being made about an account, in the site's own words.
 *
 * One sentence, and both branches are load-bearing. The `existence` wording has
 * to stop a reasonable person concluding that we checked the reader is this
 * person, because we did not, and a sponsor is about to spend money on the
 * difference. Do not soften it into "verified".
 */
export function confirmationClaim(identity: RequesterIdentity): string {
  const label = providerLabel(identity.provider)
  return identity.confirmation === 'control'
    ? `Signed in with ${label}, so this account is theirs.`
    : `We found this ${label} account and read its public profile. We did not check that the person asking is the one who holds it.`
}

/**
 * One-line description for emails and logs: 'Jane Doe (@jane on X)'.
 *
 * A named-but-unproved account is marked as such, so the press reading a
 * notification is never left to assume the stronger of the two checks.
 */
export function describeIdentity(identity: RequesterIdentity | null | undefined): string {
  if (!identity) return 'unverified'
  const label = providerLabel(identity.provider)
  const who = identity.handle
    ? `${identity.name} (@${identity.handle} on ${label})`
    : `${identity.name} (${label})`
  return identity.confirmation === 'control' ? who : `${who} — named, not proved`
}
