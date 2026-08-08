import type Stripe from 'stripe'
import { findBook } from '#shared/catalog'
// Imported explicitly rather than left to Nitro's auto-imports: ALLOWED_COUNTRIES
// below is evaluated when this module loads, which happens before the auto-import
// shims exist. Relying on them at module scope takes down every route, not just
// this one.
import { quoteRegionOptions, SHIPPING_COUNTRIES, type PrintQuoteItem } from '../utils/shipping'

interface CheckoutItem {
  slug: string
  quantity: number
}

// Countries Lulu can print/ship to and Stripe can collect an address for. Drawn
// from the shipping regions so a country can never be offered at checkout
// without an option that prices it.
const ALLOWED_COUNTRIES
  = SHIPPING_COUNTRIES as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[]

export default defineEventHandler(async (event) => {
  const body = await readBody<{ items?: CheckoutItem[] }>(event)
  const rawItems = Array.isArray(body?.items) ? body.items : []

  // Re-derive every line from the server-side catalog so the client can never
  // dictate prices.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = []
  const validatedCart: CheckoutItem[] = []
  // The same cart in Lulu's terms, so shipping is quoted for what is actually
  // being printed — page count and trim size both move the number.
  const printItems: PrintQuoteItem[] = []

  const config = useRuntimeConfig()
  const siteUrl = config.public.siteUrl.replace(/\/$/, '')

  for (const item of rawItems) {
    const book = findBook(item?.slug)
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(item?.quantity) || 0)))
    if (!book || quantity < 1) continue

    validatedCart.push({ slug: book.slug, quantity })
    printItems.push({
      podPackageId: book.lulu.podPackageId,
      pageCount: book.lulu.pageCount,
      quantity
    })
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

  // Stripe fixes these before it knows the address, so the reader picks their
  // own region and each option carries Lulu's real quote for this cart.
  const shippingOptions = await quoteRegionOptions(printItems)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    phone_number_collection: { enabled: true },
    shipping_address_collection: { allowed_countries: ALLOWED_COUNTRIES },
    shipping_options: shippingOptions.map(option => ({
      shipping_rate_data: {
        type: 'fixed_amount' as const,
        display_name: option.region.label,
        fixed_amount: { amount: option.amountCents, currency: 'usd' },
        delivery_estimate: {
          minimum: { unit: 'business_day' as const, value: option.region.businessDays.min },
          maximum: { unit: 'business_day' as const, value: option.region.businessDays.max }
        }
      }
    })),
    metadata: {
      cart: JSON.stringify(validatedCart)
    },
    success_url: `${siteUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cart`
  })

  return { id: session.id, url: session.url }
})
