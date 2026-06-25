import type Stripe from 'stripe'
import { findBook } from '#shared/catalog'

interface CheckoutItem {
  slug: string
  quantity: number
}

// Countries Lulu can print/ship to and Stripe can collect an address for.
const ALLOWED_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] = [
  'US', 'CA', 'GB', 'IE', 'AU', 'NZ', 'DE', 'FR', 'NL', 'BE', 'ES', 'IT', 'SE', 'DK', 'FI', 'NO', 'CH', 'AT', 'PL', 'PT'
]

export default defineEventHandler(async (event) => {
  const body = await readBody<{ items?: CheckoutItem[] }>(event)
  const rawItems = Array.isArray(body?.items) ? body.items : []

  // Re-derive every line from the server-side catalog so the client can never
  // dictate prices.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  const validatedCart: CheckoutItem[] = []

  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl.replace(/\/$/, '')

  for (const item of rawItems) {
    const book = findBook(item?.slug)
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item?.quantity) || 0)))
    if (!book || quantity < 1) continue

    validatedCart.push({ slug: book.slug, quantity })
    lineItems.push({
      quantity,
      price_data: {
        currency: book.currency,
        unit_amount: book.priceCents,
        product_data: {
          name: book.title,
          description: book.subtitle || book.author,
          images: siteUrl.startsWith('https') ? [`${siteUrl}${book.cover}`] : undefined,
          metadata: { slug: book.slug }
        }
      }
    })
  }

  if (lineItems.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Your cart is empty.' })
  }

  const stripe = useStripe()

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    phone_number_collection: { enabled: true },
    shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: 'Standard (printed on demand)',
          fixed_amount: { amount: 499, currency: 'usd' },
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 7 },
            maximum: { unit: 'business_day', value: 21 }
          }
        }
      },
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          display_name: 'Expedited',
          fixed_amount: { amount: 1299, currency: 'usd' },
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 3 },
            maximum: { unit: 'business_day', value: 8 }
          }
        }
      }
    ],
    metadata: {
      cart: JSON.stringify(validatedCart)
    },
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cart`
  })

  return { id: session.id, url: session.url }
})
