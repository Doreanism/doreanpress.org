import { describe, expect, it } from 'vitest'
import { catalog } from '../shared/catalog'
import type { RequesterIdentity } from '../shared/identity'
import { destinationKey, foldOrders, orderKey, type BookRequest } from '../server/utils/requests'

// These three are pure — they never reach the database — so they are exercised
// here directly. The rest of `server/utils/requests.ts` is not: those functions
// all go through `db()`.
//
// Together they are the whole of "one open order per doorstep": `destinationKey`
// and `orderKey` decide whether a reader is asking again for the same parcel,
// and `foldOrders` is what that second ask does to the order already waiting.

const A = catalog[0]!.slug
const B = catalog[1]!.slug

function account(subject: string): RequesterIdentity {
  return { provider: 'x', subject, name: `Reader ${subject}`, verifiedAt: '2026-01-01T00:00:00.000Z' }
}

let seq = 0

function request(over: Partial<BookRequest> = {}): BookRequest {
  seq += 1
  return {
    id: `req-${seq}`,
    items: [{ slug: A, quantity: 1 }],
    message: 'Please, if you can.',
    requester: account('ada'),
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '555',
    address: { line1: '12 Bell St', city: 'Sunnyvale', state: 'CA', postalCode: '94085', country: 'US' },
    status: 'open',
    createdAt: '2026-07-01T00:00:00.000Z',
    ...over
  }
}

describe('destinationKey', () => {
  it('ignores case, punctuation and doubled spacing', () => {
    expect(destinationKey(request({ address: { line1: 'Apt. 4, 12 Bell St', city: 'Sunnyvale', postalCode: '94085', country: 'US' } })))
      .toBe(destinationKey(request({ address: { line1: 'apt 4  12 bell st', city: 'sunnyvale', postalCode: '94085', country: 'us' } })))
  })

  it('ignores how a postcode is spaced or hyphenated', () => {
    const at = (postalCode: string) => destinationKey(request({ address: { line1: '1 A St', city: 'London', postalCode, country: 'GB' } }))
    expect(at('SW1A 1AA')).toBe(at('sw1a1aa'))
    expect(at('94085-1234')).toBe(at('940851234'))
  })

  it('does not guess that an abbreviation is the same street', () => {
    const street = (line1: string) => destinationKey(request({ address: { line1, city: 'Sunnyvale', postalCode: '94085', country: 'US' } }))
    expect(street('12 Bell St')).not.toBe(street('12 Bell Street'))
  })

  it('separates its fields, so text cannot slide from one into the next', () => {
    const a = destinationKey(request({ address: { line1: '12 Bell', city: 'St Sunnyvale', postalCode: '94085', country: 'US' } }))
    const b = destinationKey(request({ address: { line1: '12 Bell St', city: 'Sunnyvale', postalCode: '94085', country: 'US' } }))
    expect(a).not.toBe(b)
  })

  it('reads a parcel addressed to someone else as somewhere else', () => {
    expect(destinationKey(request())).not.toBe(destinationKey(request({ name: 'A Friend' })))
  })
})

describe('orderKey', () => {
  it('is the same for one account asking twice for one doorstep', () => {
    expect(orderKey(request())).toBe(orderKey(request({ message: 'And one more, please.' })))
  })

  it('separates two accounts at one address', () => {
    expect(orderKey(request())).not.toBe(orderKey(request({ requester: account('grace') })))
  })

  it('is null without an account, so unverified rows are never folded together', () => {
    expect(orderKey(request({ requester: null }))).toBeNull()
  })
})

describe('foldOrders', () => {
  it('adds the new books to the ones already waiting', () => {
    const folded = foldOrders(
      { items: [{ slug: A, quantity: 1 }], message: 'First.' },
      { items: [{ slug: A, quantity: 2 }, { slug: B, quantity: 1 }], message: 'Second.' }
    )
    expect(folded.items).toEqual([{ slug: A, quantity: 3 }, { slug: B, quantity: 1 }])
  })

  it('keeps the new words under the old ones', () => {
    expect(foldOrders({ items: [], message: 'First.' }, { items: [], message: 'Second.' }).message)
      .toBe('First.\n\nSecond.')
  })

  it('does not repeat a message the reader has already said', () => {
    expect(foldOrders({ items: [], message: 'Same words.' }, { items: [], message: ' Same words. ' }).message)
      .toBe('Same words.')
  })

  it('drops the oldest words rather than growing without end', () => {
    let order = { items: [] as { slug: string, quantity: number }[], message: 'The very first thing I said.' }
    for (let i = 0; i < 40; i++) {
      order = foldOrders(order, { items: [], message: `${'a plea of some length '.repeat(5)}#${i}` })
    }
    expect(order.message.length).toBeLessThanOrEqual(2000)
    expect(order.message).not.toContain('The very first thing I said.')
    expect(order.message).toContain('#39')
  })

  it('leaves the order it was given alone', () => {
    const existing = { items: [{ slug: A, quantity: 1 }], message: 'First.' }
    foldOrders(existing, { items: [{ slug: A, quantity: 4 }], message: 'Second.' })
    expect(existing).toEqual({ items: [{ slug: A, quantity: 1 }], message: 'First.' })
  })
})
