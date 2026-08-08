// Everything the signed-in address is party to, in three groups.
//
// The address is taken from the session, never from the query string. It is the
// whole authorisation here — asking for `?email=someone@else` has to be
// impossible rather than merely discouraged, so the parameter does not exist.
//
//   requested — free-book requests this address asked for
//   sponsored — requests this address paid for on someone else's behalf
//   purchased — books this address bought for itself from the catalog
//
// The three are separate rather than one merged list because they are owed
// different things. A request is something you are waiting on; a sponsorship is
// something you gave; a purchase is something you bought. Merging them would
// mean inventing a single verb for all three and getting it wrong for two.

import { itemTitles } from '#shared/catalog'
import { toGivenView, toMineView } from '../utils/orderViews'

export default defineEventHandler(async (event) => {
  const { email } = await requireSignedIn(event, 'seeing your orders')

  const [requested, sponsored, purchased] = await Promise.all([
    listRequestsForEmail(email),
    listRequestsSponsoredBy(email),
    listOrdersForEmail(email)
  ])

  return {
    email,
    requested: requested.map(toMineView),
    sponsored: sponsored.map(toGivenView),
    purchased: purchased.map(o => ({
      id: o.id,
      items: o.items,
      titles: itemTitles(o.items),
      amountCents: o.amountCents,
      currency: o.currency,
      shippingStatus: o.shippingStatus,
      trackingUrl: o.trackingUrl,
      createdAt: o.createdAt
    }))
  }
})
