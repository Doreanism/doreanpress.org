import { describe, expect, it } from 'vitest'
import {
  accountKey,
  CHALLENGE_PROVIDERS,
  describeIdentity,
  IDENTITY_PROVIDERS,
  isSameAccount,
  providerIcon,
  providerLabel,
  type RequesterIdentity
} from '../shared/identity'

function identity(over: Partial<RequesterIdentity> = {}): RequesterIdentity {
  return {
    provider: 'x',
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
})

describe('provider metadata', () => {
  it('describes every provider a reader can prove an account with', () => {
    for (const provider of CHALLENGE_PROVIDERS) {
      expect(IDENTITY_PROVIDERS[provider]).toBeDefined()
      expect(providerLabel(provider)).toBeTruthy()
      expect(providerIcon(provider)).toMatch(/^i-/)
    }
  })

  it('never offers the dev-only stand-in as a real option', () => {
    expect(CHALLENGE_PROVIDERS).not.toContain('mock')
    expect(IDENTITY_PROVIDERS.mock.devOnly).toBe(true)
  })

  it('only claims a public profile link for providers that actually give one', () => {
    // Facebook's user_link and LinkedIn's vanity name are both behind partner
    // review; claiming otherwise would render a badge that links nowhere.
    expect(IDENTITY_PROVIDERS.x.linkable).toBe(true)
    expect(IDENTITY_PROVIDERS.facebook.linkable).toBe(false)
    expect(IDENTITY_PROVIDERS.linkedin.linkable).toBe(false)
  })
})
