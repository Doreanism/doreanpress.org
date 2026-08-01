import { describe, expect, it } from 'vitest'
import {
  accountKey,
  CHALLENGE_PROVIDERS,
  confirmationClaim,
  describeIdentity,
  IDENTITY_PROVIDERS,
  isControlConfirmed,
  isSameAccount,
  LOOKUP_PROVIDERS,
  providerIcon,
  providerLabel,
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
    const offered = [...CHALLENGE_PROVIDERS, ...LOOKUP_PROVIDERS]
    expect(Object.keys(IDENTITY_PROVIDERS).sort()).toEqual([...offered].sort())
    for (const provider of LOOKUP_PROVIDERS) {
      expect(IDENTITY_PROVIDERS[provider]).toBeDefined()
      expect(providerIcon(provider)).toMatch(/^i-/)
    }
  })

  it('never offers the same provider both ways', () => {
    for (const provider of CHALLENGE_PROVIDERS) {
      expect(LOOKUP_PROVIDERS).not.toContain(provider)
    }
  })

  // The two lists are what every downstream rule keys off, so a provider filed
  // under the wrong one would hand out the strong claim for the weak check.
  it('files each provider under the check it can actually do', () => {
    for (const provider of CHALLENGE_PROVIDERS) {
      expect(IDENTITY_PROVIDERS[provider].confirms).toBe('control')
    }
    for (const provider of LOOKUP_PROVIDERS) {
      expect(IDENTITY_PROVIDERS[provider].confirms).toBe('existence')
      // A reader has to be told what to type, or the field is a guessing game.
      expect(IDENTITY_PROVIDERS[provider].accountHint).toBeTruthy()
      expect(IDENTITY_PROVIDERS[provider].accountExample).toBeTruthy()
    }
  })

  // None of these three can be looked up: Facebook removed username lookup from
  // the Graph API, LinkedIn has no public profile API, and X's needs a paid
  // token. Adding one here would mean somebody had reached for HTML scraping.
  it('keeps the providers with no public lookup API out of the lookup list', () => {
    expect(LOOKUP_PROVIDERS).not.toContain('x')
    expect(LOOKUP_PROVIDERS).not.toContain('facebook')
    expect(LOOKUP_PROVIDERS).not.toContain('linkedin')
  })

  it('only claims a public profile link for providers that actually give one', () => {
    // Facebook's user_link and LinkedIn's vanity name are both behind partner
    // review; claiming otherwise would render a badge that links nowhere.
    expect(IDENTITY_PROVIDERS.x.linkable).toBe(true)
    expect(IDENTITY_PROVIDERS.facebook.linkable).toBe(false)
    expect(IDENTITY_PROVIDERS.linkedin.linkable).toBe(false)
  })
})
