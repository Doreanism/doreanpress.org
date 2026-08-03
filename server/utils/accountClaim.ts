// Taking a reader's word for an account, when there is no way to do better.
//
// The floor of the three rungs in `Confirmation`. Nothing here contacts the
// provider, because for these five there is nothing to contact: Facebook removed
// username lookup, LinkedIn has no public profile API, X's needs a paid token,
// and Twitch and TikTok both want an app token. So on a deployment without their
// OAuth credentials, a reader whose only account is on one of them can either
// say so unchecked or not ask for a book at all.
//
// What this does buy the sponsor is one real thing: a profile address to open.
// That is the entire value, and every word of copy around it is written so a
// sponsor spends their money on what they see there rather than on our badge.
//
// Two rules hold here, and the second is not obvious:
//
//  1. The handle must be shaped like one the provider could actually issue.
//     This proves nothing about existence — it is not meant to. It stops a typo
//     or a pasted sentence becoming a dead link on a public board.
//  2. The account key is namespaced, and it must stay that way. See `claimKey`.

import { normalizeAccount } from './accountLookup'
import {
  CLAIM_PROVIDERS,
  IDENTITY_PROVIDERS,
  type ClaimProvider,
  type RequesterIdentity
} from '#shared/identity'

/**
 * Per provider: what a handle may look like, and where it points.
 *
 * The patterns are the providers' own published rules, kept deliberately
 * permissive — refusing a real account because a rule changed is a worse failure
 * here than accepting a handle that turns out to be free, since nothing about
 * this rung claims the account is taken in the first place.
 */
const CLAIM_SHAPES: Record<ClaimProvider, { pattern: RegExp, profileUrl: (handle: string) => string }> = {
  x: {
    pattern: /^\w{1,15}$/,
    profileUrl: h => `https://x.com/${encodeURIComponent(h)}`
  },
  facebook: {
    pattern: /^[a-z\d.]{5,50}$/i,
    profileUrl: h => `https://www.facebook.com/${encodeURIComponent(h)}`
  },
  linkedin: {
    pattern: /^[a-z\d-]{3,100}$/i,
    profileUrl: h => `https://www.linkedin.com/in/${encodeURIComponent(h)}`
  },
  twitch: {
    pattern: /^\w{4,25}$/,
    profileUrl: h => `https://www.twitch.tv/${encodeURIComponent(h)}`
  },
  tiktok: {
    pattern: /^[a-z\d._]{2,24}$/i,
    profileUrl: h => `https://www.tiktok.com/@${encodeURIComponent(h)}`
  }
}

export function isClaimProvider(value: string): value is ClaimProvider {
  return (CLAIM_PROVIDERS as string[]).includes(value)
}

/**
 * The account key for a claimed handle — namespaced, and this is load-bearing.
 *
 * Every other rung keys off the provider's own id for the account. A claimed
 * account has no id, only what somebody typed, and on X a username may be all
 * digits — so an unprefixed key would let a reader claim the handle `1234567`
 * and land on `x:1234567`, the exact key the real account with numeric id
 * 1234567 gets when its holder signs in.
 *
 * That is not a cosmetic collision. `accountKey` is what `requireRequestOwner`
 * compares and what the per-account limit counts, so the two accounts would
 * become one: the claimer could edit and withdraw the real holder's request.
 * The prefix keeps the namespaces apart, and nothing may key a claimed account
 * without it.
 */
export function claimKey(handle: string): string {
  return `claimed:${handle.toLowerCase()}`
}

export type ClaimOutcome
  = | { status: 'ok', identity: Omit<RequesterIdentity, 'verifiedAt'> }
    | { status: 'unsupported' }
    | { status: 'malformed' }

/**
 * Turn what the reader typed into an identity, or refuse it on shape.
 *
 * Pure — no network, no clock, no database — so the whole of this rung's logic
 * is reachable from a test.
 */
export function claimAccount(provider: string, raw: string): ClaimOutcome {
  if (!isClaimProvider(provider)) return { status: 'unsupported' }

  const handle = normalizeAccount(provider, raw)
  const shape = CLAIM_SHAPES[provider]
  if (!handle || !shape.pattern.test(handle)) return { status: 'malformed' }

  return {
    status: 'ok',
    identity: {
      provider,
      confirmation: 'claimed',
      subject: claimKey(handle),
      // No display name to be had — nobody told us one. The handle is what the
      // reader typed and what a sponsor will see on the profile, so it is the
      // most honest thing to put here.
      name: handle,
      handle,
      profileUrl: shape.profileUrl(handle)
      // Deliberately absent: avatarUrl (the badge falls back to initials),
      // accountCreatedAt, and providerVerified. Every one of those would be an
      // invention, and `providerVerified` in particular would render somebody
      // else's blue check beside an unchecked claim to be them.
    }
  }
}

/** What the field should ask for, and show as a placeholder. */
export function claimHint(provider: ClaimProvider): { hint: string, example: string } {
  const meta = IDENTITY_PROVIDERS[provider]
  return { hint: meta.accountHint ?? 'username', example: meta.accountExample ?? '' }
}
