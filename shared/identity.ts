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
    | 'github' | 'bluesky' | 'mastodon' | 'gitlab' | 'codeberg' | 'stackoverflow'

/**
 * What a completed check actually establishes. The single most important
 * distinction in this file — everything a sponsor is shown depends on it.
 *
 * Three rungs, strongest first:
 *
 * - `control` — the reader went to the provider, signed in, and the provider
 *   told us who they are. They *are* this account.
 * - `existence` — the reader typed an account and we fetched its public profile.
 *   The account is real and looks as described; whether the reader is the person
 *   holding it is not established, and must never be implied.
 * - `claimed` — the reader typed an account and we checked *nothing*. Not that
 *   it is theirs, not even that it is there. All we did was confirm the handle
 *   is shaped like one that provider could issue, and build a link a sponsor can
 *   open for themselves.
 *
 * The bottom two are weak in a specific, load-bearing way: handles are free to
 * type, so neither prevents impersonation nor makes a second posting cost
 * anything. Rules that lean on scarcity have to bite somewhere else for these —
 * see the doorstep check in `POST /api/requests`, which keys off
 * `confirmation !== 'control'` and so covers both without needing to know about
 * this third rung at all.
 *
 * `claimed` exists because Facebook, X and LinkedIn have no public profile API,
 * so on a deployment without their OAuth credentials there is otherwise no way
 * for a reader on those to say so. It buys the sponsor exactly one thing — an
 * address to go and look at — and the copy must never suggest it buys more.
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
   * The strongest thing this provider can be made to establish here.
   *
   * Not what a given identity carries — that is `confirmation` on the identity
   * itself, set by whichever route did the checking. A provider offering both
   * routes reads `control` here, because that is the best it can do; an account
   * of theirs that was merely named still carries `existence`.
   */
  confirms: Confirmation
  /** For lookup providers: what the reader is being asked to type. */
  accountHint?: string
  /** For lookup providers: a example of the shape, shown in the field. */
  accountExample?: string
}

export const IDENTITY_PROVIDERS: Record<IdentityProvider, ProviderMeta> = {
  // The five with no public lookup API. Each still carries an account hint,
  // because when this deployment has no credentials for one the reader can name
  // it anyway — unchecked, and labelled so. See CLAIM_PROVIDERS.
  x: {
    label: 'X',
    icon: 'i-simple-icons-x',
    linkable: true,
    confirms: 'control',
    accountHint: 'username',
    accountExample: 'jack'
  },
  facebook: {
    label: 'Facebook',
    icon: 'i-simple-icons-facebook',
    linkable: false,
    confirms: 'control',
    accountHint: 'username, or the name in your profile link',
    accountExample: 'jane.doe'
  },
  linkedin: {
    label: 'LinkedIn',
    icon: 'i-simple-icons-linkedin',
    linkable: false,
    confirms: 'control',
    accountHint: 'the name at the end of your profile link',
    accountExample: 'jane-doe-1a2b3c'
  },
  twitch: {
    label: 'Twitch',
    icon: 'i-simple-icons-twitch',
    linkable: true,
    confirms: 'control',
    accountHint: 'username',
    accountExample: 'alice'
  },
  tiktok: {
    label: 'TikTok',
    icon: 'i-simple-icons-tiktok',
    linkable: false,
    confirms: 'control',
    accountHint: 'username',
    accountExample: 'alice'
  },
  // The one provider on both lists: a reader can sign in with GitHub or, where
  // that is not configured, simply name an account for us to read.
  github: {
    label: 'GitHub',
    icon: 'i-simple-icons-github',
    linkable: true,
    confirms: 'control',
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
  },
  gitlab: {
    label: 'GitLab',
    icon: 'i-simple-icons-gitlab',
    linkable: true,
    confirms: 'existence',
    accountHint: 'username',
    accountExample: 'alice'
  },
  codeberg: {
    label: 'Codeberg',
    icon: 'i-simple-icons-codeberg',
    linkable: true,
    confirms: 'existence',
    accountHint: 'username',
    accountExample: 'alice'
  },
  stackoverflow: {
    label: 'Stack Overflow',
    icon: 'i-simple-icons-stackoverflow',
    linkable: true,
    confirms: 'existence',
    // The odd one out, and it has to be: Stack Overflow display names are not
    // unique — two people can hold the same one — so a name is not an account
    // there. The numeric id in the profile URL is, and asking for the link is
    // kinder than asking somebody to dig the number out of it themselves.
    accountHint: 'profile link, or the number in it',
    accountExample: 'https://stackoverflow.com/users/22656'
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
export type ChallengeProvider = Extract<
  IdentityProvider, 'x' | 'facebook' | 'linkedin' | 'twitch' | 'tiktok' | 'github'
>

/** In the order offered, which is the order they were added. */
export const CHALLENGE_PROVIDERS: ChallengeProvider[] = [
  'x', 'facebook', 'linkedin', 'github', 'twitch', 'tiktok'
]

/**
 * Providers whose accounts a reader can simply *name*, for us to go and read.
 *
 * Each is here because it actually allows it: a public profile over a
 * documented, unauthenticated API that answers "no such account"
 * distinguishably. That is the whole bar, and it is what keeps X, Facebook and
 * LinkedIn out — Facebook removed username lookup from the Graph API, LinkedIn
 * has no public profile API at all, and X's requires a paid bearer token.
 * Reading their HTML instead would be scraping: against their terms, blocked
 * from server IPs, and broken by the next markup change. If one of them ever
 * needs to be offered this way, it needs credentials and a real client, not a
 * page fetch.
 */
export type LookupProvider = Extract<
  IdentityProvider, 'github' | 'bluesky' | 'mastodon' | 'gitlab' | 'codeberg' | 'stackoverflow'
>

export const LOOKUP_PROVIDERS: LookupProvider[] = [
  'github', 'bluesky', 'mastodon', 'gitlab', 'codeberg', 'stackoverflow'
]

/**
 * Providers a reader can only *say* they are on.
 *
 * Exactly the providers with no public lookup API — so this list is derived,
 * not chosen, and a provider joins `LOOKUP_PROVIDERS` the moment one becomes
 * available rather than staying here out of habit. Nothing that can be read is
 * ever merely claimed.
 *
 * This is the floor of the three rungs, and it is only ever reached when both
 * of the others are unavailable: sign-in needs credentials this deployment may
 * not have, and these five cannot be looked up at any price. The alternative to
 * offering it is telling a reader whose only account is on Facebook that they
 * may not ask for a book, which is a worse answer than showing a sponsor an
 * unchecked handle clearly labelled as unchecked.
 */
export type ClaimProvider = Exclude<IdentityProvider, LookupProvider>

export const CLAIM_PROVIDERS: ClaimProvider[] = CHALLENGE_PROVIDERS.filter(
  (p): p is ClaimProvider => !(LOOKUP_PROVIDERS as string[]).includes(p)
)

/**
 * The two lists overlap, and a deployment must still offer each provider only
 * one way.
 *
 * GitHub can be signed into *and* read publicly. Where its credentials are set,
 * offering both would be strictly worse than offering the challenge alone: the
 * only reader who would choose to merely name a GitHub account, with the sign-in
 * button right beside it, is one who cannot sign into it. So the stronger route
 * wins and the weaker one is withdrawn — see `offeredLookupProviders`, which
 * decides this per deployment, and the matching refusal in
 * `POST /api/verify/lookup` that stops it being skipped past.
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
 * One sentence each, and every branch is load-bearing. The weaker two have to
 * stop a reasonable person concluding that we checked the reader is this person,
 * because we did not, and a sponsor is about to spend money on the difference.
 * Do not soften either into "verified".
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
