import { findBook, formatPrice } from '#shared/catalog'

// Flat shipping the sponsor covers (matches the standard rate used elsewhere).
const SHIPPING_CENTS = 499

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  const request = await getRequest(id)

  if (!request || request.status !== 'open') {
    throw createError({ statusCode: 404, statusMessage: 'This request is no longer available.' })
  }

  const book = findBook(request.bookSlug)
  if (!book) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown book.' })
  }

  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl.replace(/\/$/, '')
  const stripe = useStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: book.currency,
          unit_amount: book.priceCents,
          product_data: {
            name: `Sponsor: ${book.title}`,
            description: `A copy printed & shipped to a reader who requested it (${formatPrice(book.priceCents, book.currency)}).`,
            images: siteUrl.startsWith('https') ? [`${siteUrl}${book.cover}`] : undefined,
            metadata: { slug: book.slug }
          }
        }
      },
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: SHIPPING_CENTS,
          product_data: { name: 'Shipping' }
        }
      }
    ],
    // No address collection — the book ships to the requester's stored address.
    metadata: { requestId: request.id },
    success_url: `${siteUrl}/give?sponsored=1`,
    cancel_url: `${siteUrl}/give`
  })

  return { id: session.id, url: session.url }
})
