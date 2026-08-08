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

export type IdentityProvider
  = | 'x' | 'facebook' | 'linkedin' | 'twitch' | 'tiktok'
    | 'github' | 'gitlab' | 'bluesky' | 'mastodon'
    | 'youface'

/**
 * What a completed check actually establishes.
 *
 * Only one of these can be issued: `control`. A reader goes to the provider,
 * signs in, and the provider tells us who they are — so every account attached
 * from now on is one the reader demonstrably holds. Typing a handle into a box
 * is not evidence of anything and is no longer accepted, by any route.
 *
 * The other two are **read-only history**. They describe rows posted while the
 * weaker routes existed, and the board still draws them with the verdict they
 * were actually given:
 *
 * - `existence` — the reader typed an account and we fetched its public profile.
 *   The account was real and looked as described; whether the reader was the
 *   person holding it was never established.
 * - `claimed` — the reader typed an account and we checked *nothing*. Not that
 *   it was theirs, not even that it was there.
 *
 * They are kept in the union rather than deleted because deleting them would not
 * delete the rows: it would only stop the board describing those rows honestly,
 * which is the one thing that must not happen. Nothing may *write* them — see
 * `completeChallenge`, which stamps `control` by construction, and `readProofs`,
 * which refuses any proof carrying anything else.
 *
 * Why the weaker rungs went: handles are free to type, so neither prevented
 * impersonation nor made a second posting cost anything, and a sponsor was being
 * asked to spend real money on the difference between "we read a page" and "they
 * are this person".
 */
export type Confirmation = 'control' | 'existence' | 'claimed'

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
 * A completed identity challenge, for one account.
 *
 * Evidence that whoever holds it controlled `identity` at `verifiedAt` — and
 * nothing more. It is deliberately not a login: it is raised for one action,
 * stamped onto that action, and spent.
 *
 * There is now a login, and it is a different thing that lives in the same
 * sealed cookie — signing in by a code mailed to an address, so a reader can be
 * shown their own orders (`server/utils/signedIn.ts`). Keep the two apart:
 *
 *   a proof says a public account is yours. It is minted at the provider, worth
 *   twenty minutes, and is what a stranger deciding whether to spend money on
 *   you is shown.
 *
 *   a sign-in says an inbox is yours. It is worth weeks, and says nothing to
 *   anybody but us — an email address is not evidence a giver can weigh.
 *
 * So being signed in never satisfies a check that wants a proof. Posting a
 * request goes on requiring an attached account no matter who is signed in.
 *
 * A reader may hold several at once, one per account they have attached — see
 * `MAX_ATTACHED`. They accumulate rather than replacing each other, and each
 * carries its own `id` so it can be ended on its own.
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

/**
 * How many accounts one request may carry.
 *
 * A reader attaches the profiles they want a sponsor to look at, and more than
 * one is often the honest answer: the Facebook account their friends know them
 * by says nothing checkable, and the GitHub account beside it can be read. Shown
 * together they are worth more than either alone.
 *
 * Bounded for two reasons. The proofs ride in a sealed cookie, which browsers
 * cap at 4KB and which each account costs a few hundred bytes of; and a card on
 * the board with a dozen logos on it stops being evidence and starts being
 * noise, which is the opposite of what the badge is for.
 */
export const MAX_ATTACHED = 4

/** Strongest first, for sorting and for picking the one that speaks for a set. */
const CONFIRMATION_RANK: Record<Confirmation, number> = {
  control: 0,
  existence: 1,
  claimed: 2
}

/**
 * The account that speaks for a set: the best-checked one, else the first.
 *
 * Used wherever exactly one has to be named — the row's indexed `account_key`,
 * the subject line of a notification. Never used to decide what a sponsor is
 * shown, which is always all of them: picking the strongest and drawing only
 * that would let a proved account quietly vouch for a claimed one sitting
 * invisibly behind it.
 */
export function primaryIdentity<T extends Pick<RequesterIdentity, 'confirmation'>>(
  identities: readonly T[] | null | undefined
): T | null {
  if (!identities?.length) return null
  return [...identities].sort(
    (a, b) => CONFIRMATION_RANK[a.confirmation] - CONFIRMATION_RANK[b.confirmation]
  )[0] ?? null
}

/** Strongest first, so a card reads down from the best evidence it has. */
export function byStrength<T extends Pick<RequesterIdentity, 'confirmation'>>(
  identities: readonly T[]
): T[] {
  return [...identities].sort(
    (a, b) => CONFIRMATION_RANK[a.confirmation] - CONFIRMATION_RANK[b.confirmation]
  )
}

/**
 * Whether any account here was actually signed into.
 *
 * The test the scarcity rules ask, and it is deliberately *any* rather than
 * *all*: those rules exist because a proved account costs something to come by,
 * and one is enough to have been paid for. A reader who signs in with GitHub and
 * also names their Facebook has not made the GitHub account any cheaper.
 */
export function hasControl(identities: readonly Pick<RequesterIdentity, 'confirmation'>[]): boolean {
  return identities.some(i => i.confirmation === 'control')
}

/** Whether the two sets name any account in common. */
export function sharesAccount(
  a: readonly Pick<RequesterIdentity, 'provider' | 'subject'>[] | null | undefined,
  b: readonly Pick<RequesterIdentity, 'provider' | 'subject'>[] | null | undefined
): boolean {
  if (!a?.length || !b?.length) return false
  const keys = new Set(a.map(accountKey))
  return b.some(i => keys.has(accountKey(i)))
}

export interface ProviderMeta {
  label: string
  icon: string
  /**
   * Whether the provider hands us a public profile URL *as configured here*.
   *
   * X, Twitch and every lookup provider do. Facebook's `user_link` and
   * LinkedIn's vanity name both sit behind partner review, and TikTok's handle
   * needs the `user.info.profile` scope approved, so those three show as a
   * verified name and photo with nothing to click. The TikTok route already
   * reads the handle where it is granted — this stays false until approval is
   * the ordinary case rather than the exception.
   */
  linkable: boolean
  /**
   * Whether this provider can still be attached, or is only here to describe
   * accounts already on the board.
   *
   * Mastodon is the one legacy entry. Every Mastodon server is its own OAuth
   * issuer, so signing in means registering an application with each one a
   * reader might be on — there is no single app to configure, and so no way to
   * prove a Mastodon account under the rule this file now enforces. Its metadata
   * stays because rows posted under it must keep their label and their icon.
   */
  legacy?: boolean
}

export const IDENTITY_PROVIDERS: Record<IdentityProvider, ProviderMeta> = {
  x: {
    label: 'X',
    icon: 'i-simple-icons-x',
    linkable: true
  },
  facebook: {
    label: 'Facebook',
    icon: 'i-simple-icons-facebook',
    linkable: false
  },
  linkedin: {
    label: 'LinkedIn',
    icon: 'i-simple-icons-linkedin',
    linkable: false
  },
  twitch: {
    label: 'Twitch',
    icon: 'i-simple-icons-twitch',
    linkable: true
  },
  tiktok: {
    label: 'TikTok',
    icon: 'i-simple-icons-tiktok',
    linkable: false
  },
  github: {
    label: 'GitHub',
    icon: 'i-simple-icons-github',
    linkable: true
  },
  gitlab: {
    label: 'GitLab',
    icon: 'i-simple-icons-gitlab',
    linkable: true
  },
  bluesky: {
    label: 'Bluesky',
    icon: 'i-simple-icons-bluesky',
    linkable: true
  },
  // Read-only from here down — see `legacy` on ProviderMeta.
  mastodon: {
    label: 'Mastodon',
    icon: 'i-simple-icons-mastodon',
    linkable: true,
    legacy: true
  },
  // Not a real network — see DEV_ONLY_PROVIDERS.
  youface: {
    label: 'YouFace',
    icon: 'i-lucide-venetian-mask',
    linkable: false
  }
}

/**
 * Providers that exist only on a developer's machine.
 *
 * YouFace is a social network that does not exist. Its button attaches a made-up
 * profile on the spot, with no provider, no round trip and nothing proved — so
 * the request form, the board, the four-profile allowance and the emails can all
 * be worked on without signing into anything real.
 *
 * The paragraph above `ChallengeProvider` used to say there was deliberately no
 * stand-in, on the grounds that a challenge which can be satisfied without an
 * account is not a challenge. That reasoning is still exactly right, and it is
 * why this is fenced rather than merely discouraged: `configuredProviders` drops
 * it outside dev, and `server/routes/verify/youface.get.ts` answers 404 there.
 * Both, because either alone is one edit away from shipping a button that mints
 * proofs — and `completeChallenge` stamps `control` by construction, so a forged
 * YouFace proof would be indistinguishable from a real sign-in to every rule
 * that leans on one.
 *
 * Worth knowing rather than assuming: the route is still compiled into a
 * production bundle. It is refused at runtime by a build-time-false branch, not
 * removed. Nothing here relies on tree-shaking, and neither should you.
 *
 * If you are reading this because it appeared in production: that is the bug.
 */
export type DevOnlyProvider = 'youface'

export const DEV_ONLY_PROVIDERS: readonly DevOnlyProvider[] = ['youface']

/**
 * A type guard rather than a boolean, so that narrowing it away is what lets the
 * caller reach the OAuth credentials at all: there is no `oauth.youface` to
 * configure, and TypeScript says so if the dev-only branch is ever dropped.
 */
export function isDevOnlyProvider(provider: string): provider is DevOnlyProvider {
  return (DEV_ONLY_PROVIDERS as readonly string[]).includes(provider)
}

/**
 * Providers a reader proves *control* of, by going there and coming back.
 *
 * The whole list, because it is now the only list. A provider earns its place
 * here by federating identity — offering an OAuth round trip that ends with the
 * provider itself telling us which account the reader holds. Anything that
 * cannot do that cannot be attached, however popular it is and however easy its
 * handles would be to read: an account we cannot prove is an account a sponsor
 * would be trusting on the reader's say-so.
 *
 * Every one here is a real round trip, in production and in dev alike. The one
 * exception is fenced off in `DEV_ONLY_PROVIDERS` and never reaches a deployed
 * site: a challenge that can be satisfied without an account is not a challenge,
 * so the stand-in is confined to the machine it is a convenience on.
 */
export type ChallengeProvider = Exclude<IdentityProvider, 'mastodon'>

/**
 * In the order offered, which is the order they were added.
 *
 * YouFace is last and is not offered outside dev — `configuredProviders` filters
 * it out there, so its presence in this list is not the thing that decides
 * whether a reader is ever shown it.
 */
export const CHALLENGE_PROVIDERS: ChallengeProvider[] = [
  'x', 'facebook', 'linkedin', 'github', 'twitch', 'tiktok', 'gitlab', 'bluesky',
  'youface'
]

/**
 * Whether an account on this provider can still be attached.
 *
 * There used to be two more lists here — providers whose accounts a reader could
 * *name* for us to fetch, and providers they could merely *say* they were on —
 * and the rule was that each provider was offered by the strongest route
 * available for it. The rule now has only one rung to choose from, so the lists
 * are gone with the routes that read them.
 *
 * What went with them is worth recording, so it is not rediscovered as a good
 * idea. Reading a public profile answers "is this account real", which was never
 * the question a sponsor is asking; they are asking "is this the person I am
 * about to pay for". Every rule on this site that leans on an account costing
 * something to come by — the one-order-per-account limit, request ownership,
 * withdrawal — was worth nothing against a handle that is free to type, and had
 * to be propped up by a second rule at the doorstep. One rung removes the props.
 */
export function isChallengeProvider(value: string): value is ChallengeProvider {
  return (CHALLENGE_PROVIDERS as string[]).includes(value)
}

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

/** Whether this provider can still be attached, or only described. */
export function isLegacyProvider(provider: IdentityProvider): boolean {
  return Boolean(IDENTITY_PROVIDERS[provider]?.legacy)
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
 * One sentence each, and every branch is load-bearing. Only the first can be
 * earned now; the other two are what the board says about rows posted while the
 * weaker routes existed, and they have to go on stopping a reasonable person
 * concluding that we checked the reader is this person — because we did not, and
 * a sponsor is about to spend money on the difference. Do not soften either into
 * "verified", and do not delete them while any such row is still on the board.
 *
 * The `claimed` wording says *nothing was checked* rather than leaving it to be
 * inferred from what is missing. A reader skimming three cards will not notice
 * an absent tick; they will notice a sentence that says we did not look.
 */
export function confirmationClaim(identity: RequesterIdentity): string {
  const label = providerLabel(identity.provider)
  switch (identity.confirmation) {
    case 'control':
      return `Signed in with ${label}, so this account is theirs.`
    case 'existence':
      return `We found this ${label} account and read its public profile. We did not check that the person asking is the one who holds it.`
    default:
      return `They told us this is their ${label} account. We have not checked that it exists, or that it is theirs — ${label} gives us no way to.`
  }
}

/**
 * One-line description for emails and logs: 'Jane Doe (@jane on X)'.
 *
 * Anything short of `control` is marked as such, so the press reading a
 * notification is never left to assume the strongest of the three checks. The
 * two weaker ones are distinguished from each other too — "we read this profile"
 * and "we took their word for it" are different things to act on.
 */
export function describeIdentity(identity: RequesterIdentity | null | undefined): string {
  if (!identity) return 'unverified'
  const label = providerLabel(identity.provider)
  const who = identity.handle
    ? `${identity.name} (@${identity.handle} on ${label})`
    : `${identity.name} (${label})`
  switch (identity.confirmation) {
    case 'control': return who
    case 'existence': return `${who} — named, not proved`
    default: return `${who} — claimed, nothing checked`
  }
}
