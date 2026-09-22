// Requests belonging to the signed-in reader.

import { accountKey } from '#shared/identity'
import { outstandingDeliveries } from '../utils/deliveryAddresses'
import { toMineView } from '../utils/orderViews'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const { email, accountId } = await requireSignedIn(event, 'seeing your orders')
  await claimAccountRecords(accountId)
  const { identities } = await listAttachedIdentities(event)
  const requested = await listRequestsForOwner(email, identities.map(accountKey), accountId)

  return {
    email: email || '',
    requested: requested.map(toMineView),
    outstanding: outstandingDeliveries(requested, accountId)
  }
})
