import { describe, expect, it } from 'vitest'
import { activeDeliveryAddresses, outstandingDeliveries } from '../server/utils/deliveryAddresses'
import type { BookRequest } from '../server/utils/requests'

const request: BookRequest = {
  id: 'request-1', accountId: 'reader-1', items: [], message: '', requesters: [],
  name: 'Reader', email: 'reader@example.com', phone: '555-1234',
  address: { line1: '123 Main St', city: 'Town', postalCode: '12345', country: 'US' },
  status: 'open', createdAt: '2026-09-21T00:00:00Z'
}

describe('private active delivery addresses', () => {
  it('excludes other accounts even if a public profile matched the query', () => {
    expect(activeDeliveryAddresses([
      { ...request, accountId: 'reader-2' },
      { ...request, accountId: undefined }
    ], 'reader-1')).toEqual([])
  })

  it('excludes cancelled, delivered and returned orders', () => {
    expect(activeDeliveryAddresses([
      { ...request, status: 'cancelled' },
      { ...request, fulfillment: { deliveryStatus: 'delivered' } },
      { ...request, fulfillment: { deliveryStatus: 'returned' } }
    ], 'reader-1')).toEqual([])
  })

  it('includes in-transit orders even when fulfillment is done, and deduplicates destinations', () => {
    const addresses = activeDeliveryAddresses([
      { ...request, status: 'done', fulfillment: { deliveryStatus: 'in_transit' } },
      { ...request, id: 'duplicate' },
      { ...request, id: 'other-address', address: { ...request.address, line1: '456 New St' } }
    ], 'reader-1')
    expect(addresses.map(address => address.id)).toEqual(['request-1', 'other-address'])
    expect(Object.keys(addresses[0]!).sort()).toEqual(['address', 'id', 'name'])
  })
})

describe('outstanding requests by destination', () => {
  it('clusters split funding records while preserving quantities and separate destinations', () => {
    const groups = outstandingDeliveries([
      { ...request, items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }] },
      { ...request, id: 'funded', status: 'funded_awaiting_order',
        address: { ...request.address, line1: '123 MAIN ST.' },
        items: [{ slug: 'the-doctrine-of-simony', quantity: 3 }] },
      { ...request, id: 'other', address: { ...request.address, line2: 'Apt 2' } },
      { ...request, id: 'recipient', name: 'Another Reader' }
    ], 'reader-1')
    expect(groups).toHaveLength(3)
    expect(groups[0]!.requests.map(row => row.id)).toEqual(['request-1', 'funded'])
    expect(groups[0]!.requests.flatMap(row => row.items).reduce((sum, item) => sum + item.quantity, 0)).toBe(5)
  })

  it('excludes completed deliveries and other accounts, but includes fulfillment awaiting delivery', () => {
    const groups = outstandingDeliveries([
      { ...request, id: 'done', status: 'done' },
      { ...request, id: 'delivered', fulfillment: { deliveryStatus: 'delivered' } },
      { ...request, id: 'cancelled', status: 'cancelled' },
      { ...request, id: 'returned', fulfillment: { deliveryStatus: 'returned' } },
      { ...request, id: 'other-account', accountId: 'reader-2' },
      { ...request, id: 'unclaimed', accountId: undefined }
    ], 'reader-1')
    expect(groups.flatMap(group => group.requests.map(row => row.id))).toEqual(['done'])
    expect(JSON.stringify(groups)).not.toContain(request.phone)
    expect(JSON.stringify(groups)).not.toContain(request.email)
  })
})
