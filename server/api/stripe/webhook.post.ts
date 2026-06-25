import type Stripe from 'stripe'
import { findBook } from '#shared/catalog'
import type { LuluLineItem, LuluShippingAddress, ShippingLevel } from '../../utils/lulu'

// In-memory guard against duplicate webhook deliveries. For production-grade
// idempotency, persist processed session ids (DB / KV) instead.
const processed = new Set<string>()

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const stripe = useStripe()

  const signature = getHeader(event, 'stripe-signature')
  const raw = await readRawBody(event, 'utf8')
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: 'Missing request body.' })
  }

  let stripeEvent: Stripe.Event
  const secret = config.stripeWebhookSecret
  if (secret) {
    try {
      stripeEvent = stripe.webhooks.constructEvent(raw, signature || '', secret)
    } catch (err) {
      console.error('[stripe webhook] signature verification failed:', (err as Error).message)
      throw createError({ statusCode: 400, statusMessage: 'Invalid signature.' })
    }
  } else {
    // Dev convenience only: no secret configured, trust the payload.
    console.warn('[stripe webhook] NUXT_STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev only).')
    stripeEvent = JSON.parse(raw) as Stripe.Event
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    return { received: true }
  }

  const session = stripeEvent.data.object as Stripe.Checkout.Session
  if (processed.has(session.id)) {
    return { received: true, duplicate: true }
  }
  processed.add(session.id)

  if (session.metadata?.requestId) {
    await fulfillSponsorship(session)
  } else {
    await fulfillOrder(stripe, session)
  }
  return { received: true }
})

async function fulfillSponsorship(session: Stripe.Checkout.Session) {
  const requestId = session.metadata?.requestId as string
  const request = await getRequest(requestId)

  if (!request) {
    console.error(`[sponsorship] request ${requestId} not found for session ${session.id}.`)
    return
  }
  if (request.status !== 'open') {
    console.info(`[sponsorship] request ${requestId} already fulfilled; skipping (session ${session.id}).`)
    return
  }

  const book = findBook(request.bookSlug)
  if (!book) {
    console.error(`[sponsorship] request ${requestId} references unknown book ${request.bookSlug}.`)
    return
  }

  const shippingAddress: LuluShippingAddress = {
    name: request.name,
    street1: request.address.line1,
    street2: request.address.line2 || undefined,
    city: request.address.city,
    state_code: request.address.state || undefined,
    country_code: request.address.country,
    postcode: request.address.postalCode,
    phone_number: request.phone,
    email: request.email
  }

  const lineItems: LuluLineItem[] = [{
    externalId: `${session.id}:${book.slug}`,
    title: book.title,
    podPackageId: book.lulu.podPackageId,
    pageCount: book.lulu.pageCount,
    interiorPdfUrl: book.lulu.interiorPdfUrl,
    coverPdfUrl: book.lulu.coverPdfUrl,
    quantity: 1
  }]

  try {
    const job = await createPrintJob({
      externalId: session.id,
      shippingAddress,
      lineItems,
      shippingLevel: 'MAIL'
    })
    const jobId = (job as { id?: string | number }).id
    const status = (job as { status?: { name?: string } }).status?.name || 'CREATED'

    await updateRequest(request.id, {
      status: 'fulfilled',
      sponsorEmail: session.customer_details?.email || undefined,
      stripeSessionId: session.id,
      luluJobId: jobId,
      shippingStatus: status,
      fulfilledAt: new Date().toISOString()
    })
    console.info(`[sponsorship] request ${requestId} fulfilled via Lulu job ${jobId} (mock=${isLuluMocked()}).`)

    // Close the loop: tell the requester their copy is coming, thank the sponsor.
    await sendEmail(requestFulfilledEmail({
      to: request.email,
      name: request.name,
      bookTitle: book.title,
      city: request.address.city
    }))
    const sponsorEmail = session.customer_details?.email
    if (sponsorEmail) {
      await sendEmail(sponsorThankYouEmail({ to: sponsorEmail, bookTitle: book.title }))
    }
  } catch (err) {
    console.error(`[sponsorship] FAILED to fulfil request ${requestId} for session ${session.id}:`, err)
  }
}

async function fulfillOrder(stripe: Stripe, summary: Stripe.Checkout.Session) {
  // Re-fetch to be sure we have shipping + cost details.
  const session = await stripe.checkout.sessions.retrieve(summary.id, {
    expand: ['shipping_cost']
  })

  // Stripe moved shipping details under `collected_information`; support both.
  const sAny = session as unknown as {
    shipping_details?: { name?: string, address?: Stripe.Address }
    collected_information?: { shipping_details?: { name?: string, address?: Stripe.Address } }
  }
  const shipping = sAny.collected_information?.shipping_details || sAny.shipping_details
  const address = shipping?.address

  if (!address) {
    console.error(`[fulfilment] session ${session.id} has no shipping address; skipping Lulu job.`)
    return
  }

  const cart = parseCart(session.metadata?.cart)
  const lineItems: LuluLineItem[] = []
  for (const item of cart) {
    const book = findBook(item.slug)
    if (!book) continue
    lineItems.push({
      externalId: `${session.id}:${book.slug}`,
      title: book.title,
      podPackageId: book.lulu.podPackageId,
      pageCount: book.lulu.pageCount,
      interiorPdfUrl: book.lulu.interiorPdfUrl,
      coverPdfUrl: book.lulu.coverPdfUrl,
      quantity: item.quantity
    })
  }

  if (lineItems.length === 0) {
    console.error(`[fulfilment] session ${session.id} produced no printable line items; skipping.`)
    return
  }

  const shippingAddress: LuluShippingAddress = {
    name: shipping?.name || session.customer_details?.name || 'Customer',
    street1: address.line1 || '',
    street2: address.line2 || undefined,
    city: address.city || '',
    state_code: address.state || undefined,
    country_code: address.country || '',
    postcode: address.postal_code || '',
    phone_number: session.customer_details?.phone || '',
    email: session.customer_details?.email || undefined
  }

  // Map the chosen flat-rate shipping to a Lulu shipping level.
  const shippingAmount = session.shipping_cost?.amount_total ?? 0
  const shippingLevel: ShippingLevel = shippingAmount >= 1299 ? 'EXPEDITED' : 'MAIL'

  try {
    const job = await createPrintJob({
      externalId: session.id,
      shippingAddress,
      lineItems,
      shippingLevel
    })
    const job_id = (job as { id?: string | number }).id
    console.info(`[fulfilment] Lulu print job created for session ${session.id} (job ${job_id}, mock=${isLuluMocked()}).`)
  } catch (err) {
    // Don't 500 the webhook — log loudly so the order can be reconciled by hand.
    console.error(`[fulfilment] FAILED to create Lulu print job for session ${session.id}:`, err)
  }
}

function parseCart(raw: string | undefined): { slug: string, quantity: number }[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
