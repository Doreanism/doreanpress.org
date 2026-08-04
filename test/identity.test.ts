import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  accountKey,
  byStrength,
  CHALLENGE_PROVIDERS,
  confirmationClaim,
  describeIdentity,
  IDENTITY_PROVIDERS,
  isControlConfirmed,
  isLegacyProvider,
  isSameAccount,
  hasControl,
  primaryIdentity,
  sharesAccount,
  providerIcon,
  providerLabel,
  type IdentityProvider,
  type RequesterIdentity
} from '../shared/identity'

function identity(over: Partial<RequesterIdentity> = {}): RequesterIdentity {
  return {
    provider: 'x',
    confirmation: 'control',
    subject: '123',
    name: 'Jane Doe',
    verifiedAt: '2026-07-29T00:00:00.000Z',
    ...over
  }
}

// accountKey decides both "one open request per account" and who may withdraw
// a posting, so a collision between two real people would be a security bug.
describe('accountKey', () => {
  it('separates the same subject held at different providers', () => {
    expect(accountKey({ provider: 'x', subject: '1' }))
      .not.toBe(accountKey({ provider: 'facebook', subject: '1' }))
  })

  it('is stable for the same account', () => {
    expect(accountKey({ provider: 'x', subject: 'abc' }))
      .toBe(accountKey({ provider: 'x', subject: 'abc' }))
  })
})

describe('isSameAccount', () => {
  it('matches an account against itself', () => {
    expect(isSameAccount(identity(), identity({ name: 'Renamed Since' }))).toBe(true)
  })

  it('rejects a different subject at the same provider', () => {
    expect(isSameAccount(identity(), identity({ subject: '456' }))).toBe(false)
  })

  it('rejects the same subject at a different provider', () => {
    expect(isSameAccount(identity(), identity({ provider: 'linkedin' }))).toBe(false)
  })

  // A signed-out viewer and an unverified legacy posting both arrive as
  // null/undefined here; neither may ever be treated as a match.
  it('never matches when either side is missing', () => {
    expect(isSameAccount(null, null)).toBe(false)
    expect(isSameAccount(identity(), null)).toBe(false)
    expect(isSameAccount(undefined, identity())).toBe(false)
  })
})

describe('describeIdentity', () => {
  it('includes the handle when the provider gives one', () => {
    expect(describeIdentity(identity({ handle: 'janedoe' })))
      .toBe('Jane Doe (@janedoe on X)')
  })

  it('falls back to just the provider when there is no handle', () => {
    expect(describeIdentity(identity({ provider: 'linkedin' })))
      .toBe('Jane Doe (LinkedIn)')
  })

  it('says so plainly for a posting with no account behind it', () => {
    expect(describeIdentity(null)).toBe('unverified')
  })

  // The press reads this line in a notification email and decides how much
  // weight to give the request. It must not let a named account pass for a
  // proved one just because both render as a name and a handle.
  it('marks a named account as unproved', () => {
    const named = describeIdentity(identity({
      provider: 'github',
      confirmation: 'existence',
      handle: 'janedoe'
    }))
    expect(named).toContain('named, not proved')
    expect(describeIdentity(identity())).not.toContain('named, not proved')
  })
})

// The whole design rests on these two never being confused, so the wording of
// the weaker one is pinned here rather than left to whoever edits the copy next.
describe('confirmationClaim', () => {
  it('claims the account is theirs only when they signed in', () => {
    expect(confirmationClaim(identity())).toMatch(/is theirs/)
    expect(isControlConfirmed(identity())).toBe(true)
  })

  it('never implies control for an account that was only looked up', () => {
    const claim = confirmationClaim(identity({ provider: 'github', confirmation: 'existence' }))
    expect(claim).toMatch(/did not check/i)
    expect(claim).not.toMatch(/verif/i)
    expect(claim).not.toMatch(/is theirs/)
    expect(isControlConfirmed(identity({ confirmation: 'existence' }))).toBe(false)
  })

  it('treats a missing confirmation as unproved rather than proved', () => {
    expect(isControlConfirmed(null)).toBe(false)
    expect(isControlConfirmed(undefined)).toBe(false)
  })

  // The floor. Its wording has to say that nothing was checked, rather than
  // leave it to be inferred from an absent tick — a sponsor skimming three
  // cards will not notice what is missing, only what is written.
  it('says outright that a claimed account was never checked', () => {
    const claim = confirmationClaim(identity({ provider: 'facebook', confirmation: 'claimed' }))
    expect(claim).toMatch(/not checked/i)
    expect(claim).not.toMatch(/verif/i)
    // The wording may say "nor that it is theirs" — a denial of ownership is the
    // point. What it must never carry is the assertion the top rung makes.
    expect(claim).not.toMatch(/so this account is theirs/)
    expect(claim).not.toMatch(/^Signed in/)
    // "We found this account" belongs to the rung above and would be a lie here.
    expect(claim).not.toMatch(/we found/i)
    expect(isControlConfirmed(identity({ confirmation: 'claimed' }))).toBe(false)
  })

  it('keeps the three rungs distinguishable to the press, not just the board', () => {
    const on = (confirmation: RequesterIdentity['confirmation']) =>
      describeIdentity(identity({ confirmation, handle: 'jane', name: 'Jane' }))
    expect(on('control')).toBe('Jane (@jane on X)')
    expect(on('existence')).toMatch(/named, not proved/)
    expect(on('claimed')).toMatch(/claimed, nothing checked/)
    // Each must be its own sentence, or the notification cannot be acted on.
    expect(on('existence')).not.toBe(on('claimed'))
  })
})

describe('provider metadata', () => {
  it('describes every provider a reader can prove an account with', () => {
    for (const provider of CHALLENGE_PROVIDERS) {
      expect(IDENTITY_PROVIDERS[provider]).toBeDefined()
      expect(providerLabel(provider)).toBeTruthy()
      expect(providerIcon(provider)).toMatch(/^i-/)
    }
  })

  // The roster is exactly what can be signed into, plus what can only be
  // described. A provider in the metadata that is on neither footing is one
  // nobody decided about.
  it('offers nothing that is not a real provider', () => {
    const known = Object.keys(IDENTITY_PROVIDERS) as IdentityProvider[]
    const legacy = known.filter(isLegacyProvider)
    expect([...CHALLENGE_PROVIDERS, ...legacy].sort()).toEqual([...known].sort())
  })

  // The direction that matters. A legacy provider in the offered list would put
  // a button on screen with no route behind it; the reverse — an offered
  // provider marked legacy — would hide a working one. Both are the same
  // mistake, and this pins it in both directions.
  it('never offers a provider it cannot check', () => {
    for (const provider of CHALLENGE_PROVIDERS) {
      expect(isLegacyProvider(provider), provider).toBe(false)
    }
    for (const provider of Object.keys(IDENTITY_PROVIDERS) as IdentityProvider[]) {
      if (isLegacyProvider(provider)) {
        expect(CHALLENGE_PROVIDERS as string[], provider).not.toContain(provider)
      }
    }
  })

  // Mastodon is the only account that can be on the board without being
  // provable, and it is here rather than deleted so those rows keep their label
  // and icon. If this ever fails because a second provider was retired, the
  // question to ask is whether the board still describes its rows honestly.
  it('keeps the retired provider describable', () => {
    const legacy = (Object.keys(IDENTITY_PROVIDERS) as IdentityProvider[]).filter(isLegacyProvider)
    expect(legacy).toEqual(['mastodon'])
    for (const provider of legacy) {
      expect(providerLabel(provider)).toBeTruthy()
      expect(providerIcon(provider)).toMatch(/^i-/)
    }
  })

  // Every offered provider needs the route its button points at. Offering one
  // without it is a 404 at exactly the moment a reader has agreed to prove who
  // they are, and nothing else in this suite would catch it: the list and the
  // routes are edited in different files.
  it('has a sign-in route for every provider it offers', () => {
    const routes = fileURLToPath(new URL('../server/routes/verify/', import.meta.url))
    for (const provider of CHALLENGE_PROVIDERS) {
      expect(existsSync(`${routes}${provider}.get.ts`), provider).toBe(true)
    }
  })

  it('only claims a public profile link for providers that actually give one', () => {
    // Facebook's user_link and LinkedIn's vanity name are both behind partner
    // review, and TikTok's handle behind the user.info.profile scope; claiming
    // otherwise would render a badge that links nowhere.
    expect(IDENTITY_PROVIDERS.x.linkable).toBe(true)
    expect(IDENTITY_PROVIDERS.twitch.linkable).toBe(true)
    expect(IDENTITY_PROVIDERS.facebook.linkable).toBe(false)
    expect(IDENTITY_PROVIDERS.linkedin.linkable).toBe(false)
    expect(IDENTITY_PROVIDERS.tiktok.linkable).toBe(false)
  })

  // The three that hand back a public URL owe a sponsor something to open —
  // a proved account they cannot look at is worth much less than one they can.
  it('gives a sponsor a profile to open where the provider allows it', () => {
    for (const provider of ['github', 'gitlab', 'bluesky'] as IdentityProvider[]) {
      expect(IDENTITY_PROVIDERS[provider].linkable, provider).toBe(true)
    }
  })
})

// ── several accounts on one request ──
//
// The rules that used to read one identity now read a set, and each of these
// pins the direction its answer has to fail in. Getting `hasControl` backwards
// would quietly lift a scarcity rule; getting `primaryIdentity` backwards would
// file a proved account under a claimed one's key.
describe('primaryIdentity', () => {
  const proved = identity({ subject: '1', confirmation: 'control' })
  const found = identity({ subject: '2', confirmation: 'existence' })
  const told = identity({ subject: '3', confirmation: 'claimed' })

  it('speaks for the set with its best-checked account', () => {
    expect(primaryIdentity([told, found, proved])).toBe(proved)
    expect(primaryIdentity([told, found])).toBe(found)
    expect(primaryIdentity([told])).toBe(told)
  })

  it('is null for nothing at all, so unverified rows stay unverified', () => {
    expect(primaryIdentity([])).toBeNull()
    expect(primaryIdentity(null)).toBeNull()
  })

  it('keeps the order it was given where the checks are equal', () => {
    const first = identity({ subject: 'a', confirmation: 'existence' })
    const second = identity({ subject: 'b', confirmation: 'existence' })
    expect(primaryIdentity([first, second])).toBe(first)
  })
})

describe('byStrength', () => {
  it('draws the best evidence first without disturbing the caller\'s array', () => {
    const told = identity({ subject: '3', confirmation: 'claimed' })
    const proved = identity({ subject: '1', confirmation: 'control' })
    const given = [told, proved]
    expect(byStrength(given).map(i => i.confirmation)).toEqual(['control', 'claimed'])
    expect(given[0]).toBe(told)
  })
})

describe('hasControl', () => {
  // Any, not all: one signed-in account among several has still been paid for,
  // and the scarcity rules exist to charge for exactly that.
  it('is true when any one account was signed into', () => {
    expect(hasControl([
      identity({ subject: '3', confirmation: 'claimed' }),
      identity({ subject: '1', confirmation: 'control' })
    ])).toBe(true)
  })

  it('is false when nothing was, including for an empty set', () => {
    expect(hasControl([identity({ confirmation: 'existence' })])).toBe(false)
    expect(hasControl([identity({ confirmation: 'claimed' })])).toBe(false)
    expect(hasControl([])).toBe(false)
  })
})

describe('sharesAccount', () => {
  const ada = identity({ subject: '1' })
  const grace = identity({ subject: '2' })

  it('matches on any account in common, so one is enough to prove a posting is yours', () => {
    expect(sharesAccount([grace, ada], [ada])).toBe(true)
  })

  it('does not match sets that merely look alike', () => {
    expect(sharesAccount([ada], [grace])).toBe(false)
    expect(sharesAccount([ada], [{ ...ada, provider: 'linkedin' as const }])).toBe(false)
  })

  it('is false for nothing, rather than vacuously true', () => {
    expect(sharesAccount([], [ada])).toBe(false)
    expect(sharesAccount([ada], [])).toBe(false)
    expect(sharesAccount(null, undefined)).toBe(false)
  })
})
