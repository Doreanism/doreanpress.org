import type { BookRequest } from './requests'
import { destinationKey } from './requests'
import { toMineView } from './orderViews'

export function isOutstandingRequest(request: BookRequest) {
  if (request.status === 'cancelled') return false
  return !['delivered', 'cancelled', 'canceled', 'returned', 'returned_to_sender'].includes((request.fulfillment?.deliveryStatus || '').toLowerCase())
}

/** Group only account-owned requests; matching a public profile never reveals an address. */
export function outstandingDeliveries(requests: BookRequest[], accountId: string) {
  const groups = new Map<string, {
    id: string
    name: string
    address: BookRequest['address']
    requests: ReturnType<typeof toMineView>[]
  }>()
  for (const request of requests) {
    if (request.accountId !== accountId || !isOutstandingRequest(request)) continue
    const key = destinationKey(request)
    let group = groups.get(key)
    if (!group) {
      group = { id: request.id, name: request.name, address: request.address, requests: [] }
      groups.set(key, group)
    }
    group.requests.push(toMineView(request))
  }
  return [...groups.values()]
}

/** Private delivery choices: never include requests owned only through a public profile. */
export function activeDeliveryAddresses(requests: BookRequest[], accountId: string) {
  const seen = new Set<string>()
  return requests.filter((request) => {
    if (request.accountId !== accountId) return false
    if (!isOutstandingRequest(request)) return false
    // `done` means fulfillment is complete, not necessarily delivery.
    const key = destinationKey(request)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).map(request => ({
    id: request.id,
    name: request.name,
    address: request.address
  }))
}
