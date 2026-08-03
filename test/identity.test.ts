import { describe, expect, it } from 'vitest'
import {
  accountKey,
  CHALLENGE_PROVIDERS,
  CLAIM_PROVIDERS,
  confirmationClaim,
  describeIdentity,
  IDENTITY_PROVIDERS,
  isControlConfirmed,
  isSameAccount,
  LOOKUP_PROVIDERS,
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

  // Every offered provider must be one an account is actually checked at. A
  // stand-in that satisfies the challenge without an account would quietly undo
  // the only thing the challenge is for.
  it('offers nothing that is not a real provider', () => {
    const offered = new Set([...CHALLENGE_PROVIDERS, ...LOOKUP_PROVIDERS, ...CLAIM_PROVIDERS])
    expect(Object.keys(IDENTITY_PROVIDERS).sort()).toEqual([...offered].sort())
    for (const provider of LOOKUP_PROVIDERS) {
      expect(IDENTITY_PROVIDERS[provider]).toBeDefined()
      expect(providerIcon(provider)).toMatch(/^i-/)
    }
  })

  // The three rungs have to partition the roster: every provider reachable by
  // at least one route, and nothing claimable that could be read instead. Which
  // single route a deployment offers is decided at runtime from credentials —
  // see offeredLookupProviders / offeredClaimProviders — and is not reachable
  // from here.
  it('leaves no provider unreachable, and claims nothing it could read', () => {
    for (const provider of Object.keys(IDENTITY_PROVIDERS) as IdentityProvider[]) {
      const reachable = (CHALLENGE_PROVIDERS as string[]).includes(provider)
        || (LOOKUP_PROVIDERS as string[]).includes(provider)
        || (CLAIM_PROVIDERS as string[]).includes(provider)
      expect(reachable, provider).toBe(true)
    }
    for (const provider of CLAIM_PROVIDERS) {
      expect(LOOKUP_PROVIDERS, provider).not.toContain(provider)
    }
  })

  // A reader has to be told what to type wherever they are asked to type an
  // account, and that is now both of the weaker routes.
  it('tells the reader what to type for every account they can name', () => {
    for (const provider of [...LOOKUP_PROVIDERS, ...CLAIM_PROVIDERS]) {
      expect(IDENTITY_PROVIDERS[provider].accountHint, provider).toBeTruthy()
      expect(IDENTITY_PROVIDERS[provider].accountExample, provider).toBeTruthy()
    }
  })

  // The lists may overlap — GitHub can be signed into *or* named — but only for
  // a provider that can genuinely do the stronger check. An overlap on anything
  // else would mean a lookup-only provider had been filed as provable.
  //
  // Which of the two a deployment actually offers is decided at runtime by
  // `offeredLookupProviders`, and it is never both: configuring the challenge
  // withdraws the lookup. That rule reads runtime config, so it is not reachable
  // from here — it is the untested handler rule flagged in the docs.
  it('only lets a provider sit on both lists if it can prove control', () => {
    const both = CHALLENGE_PROVIDERS.filter(p => (LOOKUP_PROVIDERS as string[]).includes(p))
    expect(both).toEqual(['github'])
    for (const provider of both) {
      expect(IDENTITY_PROVIDERS[provider].confirms).toBe('control')
    }
  })

  // The two lists are what every downstream rule keys off, so a provider filed
  // under the wrong one would hand out the strong claim for the weak check.
  it('files each provider under the check it can actually do', () => {
    for (const provider of CHALLENGE_PROVIDERS) {
      expect(IDENTITY_PROVIDERS[provider].confirms).toBe('control')
    }
    for (const provider of LOOKUP_PROVIDERS) {
      // `confirms` is the best a provider can do, so one that is only ever
      // looked up must say so. GitHub is exempt because it is also signed into.
      if (!(CHALLENGE_PROVIDERS as string[]).includes(provider)) {
        expect(IDENTITY_PROVIDERS[provider].confirms).toBe('existence')
      }
      // A reader has to be told what to type, or the field is a guessing game.
      expect(IDENTITY_PROVIDERS[provider].accountHint).toBeTruthy()
      expect(IDENTITY_PROVIDERS[provider].accountExample).toBeTruthy()
    }
  })

  // None of these can be looked up: Facebook removed username lookup from the
  // Graph API, LinkedIn has no public profile API, X's needs a paid token, and
  // Twitch and TikTok both require an app token for theirs. Adding one here
  // would mean somebody had reached for HTML scraping.
  it('keeps the providers with no public lookup API out of the lookup list', () => {
    for (const provider of ['x', 'facebook', 'linkedin', 'twitch', 'tiktok']) {
      expect(LOOKUP_PROVIDERS).not.toContain(provider)
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

  // Being publicly readable is what makes a provider lookup-able in the first
  // place, so every one of them owes a sponsor something to open.
  it('gives a sponsor a profile to open for every account that can be named', () => {
    for (const provider of LOOKUP_PROVIDERS) {
      expect(IDENTITY_PROVIDERS[provider].linkable, provider).toBe(true)
    }
  })
})
