import type Stripe from 'stripe'
import { findBook, formatPrice, itemsSubtotalCents, SPONSOR_SHIPPING_CENTS } from '#shared/catalog'

// A sponsor covers a request in full — every title the reader asked for, plus
// one shipping charge for the single parcel it all ships in. Requests are never
// sponsorable book-by-book: a half-funded order can't be printed or shipped.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  const request = await getRequest(id)

  if (!request || request.status !== 'open') {
    throw createError({ statusCode: 404, statusMessage: 'This request is no longer available.' })
  }

  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl.replace(/\/$/, '')

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  for (const item of request.items) {
    const book = findBook(item.slug)
    if (!book) continue
    lineItems.push({
      quantity: item.quantity,
      price_data: {
        currency: book.currency,
        unit_amount: book.priceCents,
        product_data: {
          name: `Sponsor: ${book.title}`,
          description: `Printed & shipped to a reader who requested it (${formatPrice(book.priceCents, book.currency)} per copy).`,
          images: siteUrl.startsWith('https') ? [`${siteUrl}${book.cover}`] : undefined,
          metadata: { slug: book.slug }
        }
      }
    })
  }

  if (lineItems.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'This request has no books we can print.' })
  }

  lineItems.push({
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: SPONSOR_SHIPPING_CENTS,
      product_data: { name: 'Shipping', description: 'One parcel for the whole order.' }
    }
  })

  const stripe = useStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    // No address collection — the order ships to the requester's stored address.
    metadata: {
      requestId: request.id,
      // Snapshot of what was funded, for reconciling against the board later.
      items: JSON.stringify(request.items),
      subtotalCents: String(itemsSubtotalCents(request.items))
    },
    success_url: `${siteUrl}/give?sponsored=1`,
    cancel_url: `${siteUrl}/give`
  })

  return { id: session.id, url: session.url }
})
