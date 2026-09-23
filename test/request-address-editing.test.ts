import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { planAddressEdit } from '../server/utils/requestAddressEditing'
import type { BookRequest } from '../server/utils/requests'

function request(id: string, overrides: Partial<BookRequest> = {}): BookRequest {
  return {
    id, accountId: 'reader', status: 'open', createdAt: '2026-09-01',
    name: 'Reader', address: { line1: `${id} Main St`, city: 'Town', postalCode: '12345', country: 'US' },
    items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }], message: `Message ${id}`,
    email: 'reader@example.test', phone: '', requesters: [], ...overrides
  }
}
const source = request('source')
const target = request('target')
const originalDestination = { name: source.name, address: source.address }

beforeEach(() => vi.stubGlobal('createError', (input: object) => Object.assign(new Error(), input)))
afterEach(() => vi.unstubAllGlobals())

describe('editing request addresses', () => {
  it('combines quantities and messages into the selected open order', () => {
    const plan = planAddressEdit(source, [source, target], 'reader', { originalDestination, targetRequestId: target.id })
    expect(plan.survivor.id).toBe(target.id)
    expect(plan.patch).toMatchObject({ name: target.name, address: target.address,
      items: [{ slug: 'the-doctrine-of-simony', quantity: 4 }], message: 'Message target\n\nMessage source' })
    expect(plan.affected).toHaveLength(2)
  })
  it('also merges a typed matching address, ignoring formatting differences', () => {
    const plan = planAddressEdit(source, [target], 'reader', {
      originalDestination, name: ' reader ', address: { ...target.address, line1: 'TARGET Main St.' }
    })
    expect(plan.survivor.id).toBe(target.id)
    expect(plan.affected).toHaveLength(2)
  })
  it('updates a new address without merging another recipient at that address', () => {
    const plan = planAddressEdit(source, [target], 'reader', { originalDestination, name: 'Someone Else', address: target.address })
    expect(plan.survivor.id).toBe(source.id)
    expect(plan.affected).toEqual([source])
    expect(plan.patch.items).toEqual(source.items)
  })
  it('reuses a funded order’s address without changing its books or fulfillment', () => {
    const funded = request('funded', { status: 'ordered' })
    const plan = planAddressEdit(source, [funded], 'reader', { originalDestination, targetRequestId: funded.id })
    expect(plan.affected).toEqual([source])
    expect(plan.expected).toEqual([source, funded])
    expect(plan.patch.address).toEqual(funded.address)
    expect(plan.patch.items).toEqual(source.items)
  })
  it('combines all open requests at the destination while leaving funded rows intact', () => {
    const duplicate = request('duplicate', { address: target.address })
    const funded = request('funded', { address: target.address, status: 'funded_awaiting_order' })
    const plan = planAddressEdit(source, [target, duplicate, funded], 'reader', { originalDestination, targetRequestId: funded.id })
    expect(plan.affected).toHaveLength(3)
    expect(plan.expected).toHaveLength(4)
    expect(plan.patch.items[0]?.quantity).toBe(6)
  })
  it('never matches another account’s address', () => {
    const foreign = { ...target, accountId: 'other' }
    const plan = planAddressEdit(source, [foreign], 'reader', { originalDestination, name: target.name, address: target.address })
    expect(plan.affected).toEqual([source])
    expect(() => planAddressEdit(source, [foreign], 'reader', { originalDestination, targetRequestId: target.id })).toThrow()
    expect(() => planAddressEdit({ ...source, accountId: 'other' }, [], 'reader', { originalDestination })).toThrow()
  })
  it.each(['done', 'cancelled'] as const)('rejects editing a %s source', (status) => {
    expect(() => planAddressEdit({ ...source, status }, [], 'reader', { originalDestination, name: target.name, address: target.address })).toThrow()
  })
  it.each([
    request('target', { status: 'cancelled' }),
    request('target', { fulfillment: { deliveryStatus: 'delivered' } }),
    request('target', { fulfillment: { deliveryStatus: 'returned' } })
  ])('rejects inactive address choices: %j', (inactive) => {
    expect(() => planAddressEdit(source, [inactive], 'reader', { originalDestination, targetRequestId: inactive.id })).toThrow()
  })
  it.each(['fulfilled', 'funded_awaiting_order', 'ordered', 'needs_attention'] as const)('allows address changes for %s without changing donated items', (status) => {
    const funded = { ...source, status }
    const plan = planAddressEdit(funded, [funded, target], 'reader', { originalDestination, targetRequestId: target.id })
    expect(plan.survivor.id).toBe(source.id)
    expect(plan.merged).toBe(false)
    expect(plan.updates).toHaveLength(1)
    expect(plan.updates[0]).toMatchObject({ id: source.id, items: source.items, message: source.message, address: target.address })
  })
  it('moves unshipped books at the address together, preserving separate funded records', () => {
    const funded = request('funded', { status: 'funded_awaiting_order', address: source.address })
    const shipped = request('shipped', { status: 'done', address: source.address })
    const plan = planAddressEdit(source, [source, target, funded, shipped], 'reader', { originalDestination, targetRequestId: target.id })
    expect(plan.affected.map(row => row.id)).toEqual([source.id, funded.id, target.id])
    expect(plan.updates).toHaveLength(2)
    expect(plan.updates.find(row => row.id === funded.id)).toMatchObject({ items: funded.items, status: funded.status, address: target.address })
    expect(plan.updates.find(row => row.id === target.id)?.items[0]?.quantity).toBe(4)
  })
  it.each(['in_transit', 'out_for_delivery', 'delivered', 'available_for_pickup', 'returned'])('rejects shipped addresses (%s), regardless of order status', (deliveryStatus) => {
    expect(() => planAddressEdit({ ...source, status: 'needs_attention', fulfillment: { deliveryStatus } }, [], 'reader', { originalDestination, name: target.name, address: target.address })).toThrow()
  })
  it('allows pre-transit address edits and flags placed orders for attention', () => {
    const placed = { ...source, status: 'done' as const, fulfillment: { deliveryStatus: 'pre_transit', trackingUrl: 'https://www.ups.com/track', amazonOrderNumber: '123-1234567-1234567' } }
    const plan = planAddressEdit(placed, [], 'reader', { originalDestination, name: target.name, address: target.address })
    expect(plan.updates[0]).toMatchObject({ status: 'needs_attention', items: source.items })
    expect(() => planAddressEdit({ ...placed, fulfillment: { ...placed.fulfillment, shippedAt: '2026-09-01' } }, [], 'reader', { originalDestination, name: target.name, address: target.address })).toThrow()
  })
  it('rejects stale drafts and incomplete addresses', () => {
    expect(() => planAddressEdit(source, [], 'reader', { originalDestination: { ...originalDestination, name: 'Old name' }, name: target.name, address: target.address })).toThrow()
    expect(() => planAddressEdit(source, [], 'reader', { originalDestination, name: target.name, address: { ...target.address, city: '' } })).toThrow()
  })
})
