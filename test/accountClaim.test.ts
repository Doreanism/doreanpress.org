import { describe, expect, it } from 'vitest'
import { accountKey, CLAIM_PROVIDERS, LOOKUP_PROVIDERS } from '../shared/identity'
import { claimAccount, claimKey, isClaimProvider } from '../server/utils/accountClaim'

// `claimAccount` is pure — it never contacts a provider, because for these five
// there is nothing to contact. That makes the whole of this rung reachable here.

describe('which providers can be claimed', () => {
  // The list is derived from "has no public lookup API", not chosen by hand, so
  // this is really asserting that nothing readable is ever merely taken on
  // trust. If a provider gains a lookup adapter it must leave this list.
  it('never offers a claim for an account that could be read instead', () => {
    for (const provider of LOOKUP_PROVIDERS) {
      expect(isClaimProvider(provider), provider).toBe(false)
    }
  })

  it('covers exactly the providers with no public API', () => {
    expect([...CLAIM_PROVIDERS].sort()).toEqual(['facebook', 'linkedin', 'tiktok', 'twitch', 'x'])
  })

  it('refuses anything else outright', () => {
    for (const provider of ['github', 'bluesky', 'nonsense', '']) {
      expect(claimAccount(provider, 'someone')).toEqual({ status: 'unsupported' })
    }
  })
})

describe('claimAccount', () => {
  it('takes a plain handle and builds a profile a sponsor can open', () => {
    const out = claimAccount('x', 'jack')
    expect(out.status).toBe('ok')
    if (out.status !== 'ok') return
    expect(out.identity.handle).toBe('jack')
    expect(out.identity.profileUrl).toBe('https://x.com/jack')
    expect(out.identity.confirmation).toBe('claimed')
  })

  it('claims nothing it did not check', () => {
    const out = claimAccount('facebook', 'jane.doe')
    if (out.status !== 'ok') throw new Error('expected ok')
    // Every one of these would be an invention, and providerVerified would put
    // somebody else's blue check beside an unchecked claim to be them.
    expect(out.identity.avatarUrl).toBeUndefined()
    expect(out.identity.accountCreatedAt).toBeUndefined()
    expect(out.identity.providerVerified).toBeUndefined()
  })

  it('accepts a pasted profile link, since that is what a reader has', () => {
    const shapes = [
      ['x', 'https://x.com/jack', 'jack'],
      ['facebook', 'https://www.facebook.com/jane.doe', 'jane.doe'],
      ['linkedin', 'https://www.linkedin.com/in/jane-doe-1a2b3c', 'jane-doe-1a2b3c'],
      ['twitch', 'https://twitch.tv/alice', 'alice'],
      ['tiktok', 'https://www.tiktok.com/@alice', 'alice']
    ] as const
    for (const [provider, pasted, expected] of shapes) {
      const out = claimAccount(provider, pasted)
      expect(out.status, pasted).toBe('ok')
      if (out.status === 'ok') expect(out.identity.handle, pasted).toBe(expected)
    }
  })

  // Shape is the only check available and it proves nothing about existence.
  // What it does is stop a typo or a pasted sentence becoming a dead link on a
  // public board.
  it('refuses a handle the provider could not have issued', () => {
    expect(claimAccount('x', 'not a username').status).toBe('malformed')
    expect(claimAccount('x', 'waaaaaaaaaaaaaaaaytoolong').status).toBe('malformed')
    expect(claimAccount('facebook', 'shrt').status).toBe('malformed')
    expect(claimAccount('twitch', 'abc').status).toBe('malformed')
    expect(claimAccount('tiktok', 'a').status).toBe('malformed')
    expect(claimAccount('x', '   ').status).toBe('malformed')
  })
})

describe('claimKey', () => {
  // The load-bearing one. An X username may be all digits and an X user id is a
  // number, so an unprefixed key would let somebody claim the handle "1234567"
  // and land on the same `accountKey` as the real account with that id — which
  // is what requireRequestOwner compares. They would inherit the right to edit
  // and withdraw that person's request.
  it('cannot collide with a real provider id, even for an all-digit handle', () => {
    const claimedNumeric = claimAccount('x', '1234567')
    if (claimedNumeric.status !== 'ok') throw new Error('expected ok')

    const asClaimed = accountKey(claimedNumeric.identity)
    const asProved = accountKey({ provider: 'x', subject: '1234567' })

    expect(asClaimed).not.toBe(asProved)
    expect(asClaimed).toBe('x:claimed:1234567')
  })

  it('reads the same handle in any case as one account', () => {
    expect(claimKey('Jane')).toBe(claimKey('jane'))
  })

  it('keeps two different handles apart', () => {
    expect(claimKey('jane')).not.toBe(claimKey('john'))
  })
})
