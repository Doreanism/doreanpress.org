// The two boundaries the orders page could plausibly breach.
//
// One: a giver seeing where their money posted a parcel. Two: a sign-in quietly
// counting as a proof, which would let anyone with an inbox ask for free books
// without ever showing a giver who they are.
import { describe, expect, it } from 'vitest'
import { toGivenView, toMineView } from '../server/utils/orderViews'
import type { BookRequest } from '../server/utils/requests'

const REQUEST: BookRequest = {
  id: 'req-1',
  items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }],
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
    expect(view.titles).toEqual(['The Doctrine of Simony'])
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
    expect(JSON.parse(serialized).titles).toEqual(['The Doctrine of Simony'])
  })
})
