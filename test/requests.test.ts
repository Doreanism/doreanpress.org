import { describe, expect, it } from 'vitest'
import { catalog } from '../shared/catalog'
import type { RequesterIdentity } from '../shared/identity'
import { groupRequests, type BookRequest } from '../server/utils/requests'

// `groupRequests` is pure — it never reaches the database — so it is exercised
// here directly. The rest of `server/utils/requests.ts` is not: those functions
// all go through `db()`.

const A = catalog[0]!.slug

function account(subject: string): RequesterIdentity {
  return { provider: 'mock', subject, name: `Reader ${subject}`, verifiedAt: '2026-01-01T00:00:00.000Z' }
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

describe('groupRequests', () => {
  it('puts one account’s orders to one address in a single group', () => {
    const groups = groupRequests([request(), request()])
    expect(groups).toHaveLength(1)
    expect(groups[0]!.orders).toHaveLength(2)
    expect(groups[0]!.requester?.subject).toBe('ada')
  })

  it('keeps the group id and the order of the list it was given', () => {
    const newest = request()
    const oldest = request()
    const groups = groupRequests([newest, oldest])
    expect(groups[0]!.id).toBe(newest.id)
    expect(groups[0]!.orders.map(o => o.id)).toEqual([newest.id, oldest.id])
  })

  it('splits the same account across two addresses', () => {
    const away = request({ address: { line1: '3 Other Way', city: 'Oakland', postalCode: '94601', country: 'US' } })
    expect(groupRequests([request(), away])).toHaveLength(2)
  })

  it('splits the same account when the parcel is addressed to someone else', () => {
    expect(groupRequests([request(), request({ name: 'A Friend' })])).toHaveLength(2)
  })

  it('never merges two accounts, even at one address', () => {
    expect(groupRequests([request(), request({ requester: account('grace') })])).toHaveLength(2)
  })

  it('never merges unverified rows, because there is no account to merge on', () => {
    const groups = groupRequests([request({ requester: null }), request({ requester: null })])
    expect(groups).toHaveLength(2)
    expect(groups.every(g => g.orders.length === 1)).toBe(true)
  })

  it('reads a retyped address as the same address', () => {
    const retyped = request({
      name: 'ada  lovelace',
      address: { line1: '12 BELL  ST', city: 'sunnyvale', state: 'ca', postalCode: '940 85', country: 'US' }
    })
    expect(groupRequests([request(), retyped])).toHaveLength(1)
  })

  it('distinguishes addresses that differ only in the second line', () => {
    const flat = request({ address: { ...request().address, line2: 'Flat 4' } })
    expect(groupRequests([request(), flat])).toHaveLength(2)
  })

  it('emits only board-safe fields — no address, name, email or phone', () => {
    const [group] = groupRequests([request()])
    expect(Object.keys(group!.orders[0]!).sort())
      .toEqual(['createdAt', 'id', 'items', 'message', 'requester'])
  })

  it('is empty for an empty board', () => {
    expect(groupRequests([])).toEqual([])
  })
})
