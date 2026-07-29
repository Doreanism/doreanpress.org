import type Stripe from 'stripe'
import {
  findBook,
  formatPrice,
  itemsSubtotalCents,
  limitItems,
  SPONSOR_SHIPPING_CENTS,
  type RequestItem
} from '#shared/catalog'

// A sponsor covers a request in full, or picks out part of it — a few titles, or
// fewer copies than were asked for. Whatever they fund prints and ships as its
// own parcel (hence one shipping charge per sponsorship); anything left over
// stays on the board for the next giver. Sending no selection funds everything.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  const request = await getRequest(id)

  if (!request || request.status !== 'open') {
    throw createError({ statusCode: 404, statusMessage: 'This request is no longer available.' })
  }

  const body = await readBody<{ items?: RequestItem[] }>(event).catch(() => ({} as { items?: RequestItem[] }))
  const chosen = Array.isArray(body?.items) && body.items.length > 0
    ? limitItems(request.items, body.items)
    : request.items

  if (chosen.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Choose at least one book to sponsor.' })
  }

  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl.replace(/\/$/, '')

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  for (const item of chosen) {
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
      product_data: { name: 'Shipping', description: 'One parcel for the books you sponsor.' }
    }
  })

  const stripe = useStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    // No address collection — the order ships to the requester's stored address.
    metadata: {
      requestId: request.id,
      // Exactly what this sponsor funded. The webhook prints from this, not from
      // the request, so a partial gift only ever ships the part it paid for.
      items: JSON.stringify(chosen),
      subtotalCents: String(itemsSubtotalCents(chosen))
    },
    success_url: `${siteUrl}/give?sponsored=1`,
    cancel_url: `${siteUrl}/give`
  })

  return { id: session.id, url: session.url }
})
