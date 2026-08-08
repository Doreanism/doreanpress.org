// The two boundaries the orders page could plausibly breach.
//
// One: a giver seeing where their money posted a parcel. Two: a sign-in quietly
// counting as a proof, which would let anyone with an inbox ask for free books
// without ever showing a giver who they are.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toGivenView, toMineView } from '../server/utils/orderViews'
import type { BookRequest } from '../server/utils/requests'

const REQUEST: BookRequest = {
  id: 'req-1',
  items: [{ slug: 'the-dorean-principle', quantity: 2 }],
  message: 'Thank you.',
  requesters: [{
    provider: 'bluesky',
    confirmation: 'control',
    subject: 'did:plc:abc',
    name: 'A Reader',
    handle: 'reader.bsky.social',
    verifiedAt: '2026-08-01T00:00:00.000Z'
  }],
  name: 'A Reader In Full',
  email: 'reader@example.com',
  phone: '+1 555 555 5555',
  address: {
    line1: '17 Private Street',
    city: 'Columbus',
    state: 'OH',
    postalCode: '43004',
    country: 'US'
  },
  status: 'fulfilled',
  createdAt: '2026-08-01T00:00:00.000Z',
  sponsorEmail: 'giver@example.com'
}

/** Every private field on the row, by the value that would show up in JSON. */
const PRIVATE = [
  '17 Private Street',
  'Columbus',
  '43004',
  '+1 555 555 5555',
  'A Reader In Full',
  'reader@example.com'
]

describe('what a giver is shown', () => {
  it('carries no part of the recipient\'s address, name, phone or email', () => {
    const serialized = JSON.stringify(toGivenView(REQUEST))
    for (const secret of PRIVATE) {
      expect(serialized).not.toContain(secret)
    }
  })

  it('still shows what they came for', () => {
    const view = toGivenView(REQUEST)
    expect(view.titles).toEqual(['The Dorean Principle'])
    expect(view.status).toBe('fulfilled')
    // The public badge, which the board already shows them.
    expect(view.requesters[0]?.handle).toBe('reader.bsky.social')
  })

  it('does not grow new fields when the row does', () => {
    // Built key by key, so a column added to BookRequest cannot arrive here on
    // its own. If this fails, someone switched to spreading the row.
    const withNewField = { ...REQUEST, secretInternalNote: 'do not show' } as BookRequest
    expect(JSON.stringify(toGivenView(withNewField))).not.toContain('do not show')
  })
})

describe('what the person waiting is shown', () => {
  it('does not repeat their own address back at them either', () => {
    // Not a leak, but not wanted: the page is about where the books are.
    const serialized = JSON.stringify(toMineView(REQUEST))
    expect(serialized).not.toContain('17 Private Street')
    expect(JSON.parse(serialized).titles).toEqual(['The Dorean Principle'])
  })
})

describe('a sign-in is not a proof', () => {
  afterEach(() => vi.unstubAllGlobals())

  async function readProofsWith(session: Record<string, unknown>) {
    vi.resetModules()
    vi.stubGlobal('db', () => () => Promise.resolve([]))
    vi.stubGlobal('getUserSession', async () => session)
    const { readProofs } = await import('../server/utils/identityProof')
    return readProofs({} as never)
  }

  const proof = (verifiedAt: string) => ({
    id: 'proof-1',
    identity: {
      provider: 'bluesky',
      confirmation: 'control',
      subject: 'did:plc:abc',
      name: 'A Reader',
      verifiedAt
    }
  })

  it('ignores a signed-in address entirely', async () => {
    const held = await readProofsWith({ signedIn: { email: 'reader@example.com', at: new Date().toISOString() } })
    expect(held).toEqual([])
  })

  it('honours a fresh proof', async () => {
    const held = await readProofsWith({ proofs: [proof(new Date().toISOString())] })
    expect(held).toHaveLength(1)
  })

  it('refuses a proof older than its window, though the cookie now outlives it', async () => {
    // The cookie is good for thirty days so a sign-in can last. Without an
    // explicit check this proof would still be honoured on day twenty-nine.
    const old = new Date(Date.now() - 21 * 60 * 1000).toISOString()
    const held = await readProofsWith({ proofs: [proof(old)] })
    expect(held).toEqual([])
  })

  it('refuses a proof with no timestamp at all', async () => {
    const held = await readProofsWith({ proofs: [proof(undefined as unknown as string)] })
    expect(held).toEqual([])
  })
})
