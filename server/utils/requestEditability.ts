import type { BookRequest } from './requests'

/** Funding freezes books, but delivery details remain editable until shipment. */
export function canEditRequestAddress(request: BookRequest) {
  if (request.status === 'open' && (request.fundedCents || 0) > 0) return false
  if (request.status === 'cancelled' || request.fulfillment?.shippedAt) return false
  const delivery = request.fulfillment?.deliveryStatus?.toLowerCase()
  if (delivery && !['unknown', 'pre_transit'].includes(delivery)) return false
  // A recorded tracking link with no carrier status is treated as dispatched.
  if (delivery !== 'pre_transit' && (request.status === 'done' || request.fulfillment?.trackingUrl)) return false
  return true
}
