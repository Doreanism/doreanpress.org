import type Stripe from 'stripe'
import { findBook, itemsCopies, itemTitles, limitItems, subtractItems, type RequestItem } from '#shared/catalog'
import type { LuluLineItem, LuluShippingAddress, ShippingLevel } from '../../utils/lulu'

// Duplicate deliveries are kept out by a durable claim in the database — see
// `server/utils/webhookEvents.ts` for why an in-memory guard cannot work here.
//
// The two fulfil paths below share a rule that the claim depends on: they throw
// only while nothing has been printed yet, and swallow (loudly) anything that
// goes wrong afterwards. A throw releases the claim and asks Stripe to retry,
// so throwing after a print job exists would ship a second parcel.

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

  // Claimed before any work, so two deliveries racing on separate instances
  // cannot both fulfil.
  if (!await claimEvent(session.id)) {
    console.info(`[stripe webhook] session ${session.id} already handled; ignoring duplicate delivery.`)
    return { received: true, duplicate: true }
  }

  try {
    if (session.metadata?.requestId) {
      await fulfillSponsorship(session)
    } else {
      await fulfillOrder(stripe, session)
    }
  } catch (err) {
    // Nothing was printed, so hand the claim back and let Stripe retry with
    // its own backoff instead of dropping the order on the floor.
    await releaseEvent(session.id)
    console.error(`[stripe webhook] session ${session.id} failed before printing; released for retry:`, err)
    throw createError({ statusCode: 500, statusMessage: 'Fulfilment failed; please retry.' })
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

  // Print what this sponsor paid for, clamped to what the request still holds —
  // a second sponsor may have covered some of the same copies while this
  // checkout was open. Sessions created before partial gifts existed carry no
  // item snapshot and funded the whole request.
  const paidFor = parseItems(session.metadata?.items)
  const funded = paidFor.length > 0 ? limitItems(request.items, paidFor) : request.items

  if (funded.length === 0) {
    console.error(`[sponsorship] session ${session.id} paid for copies of request ${requestId} that are already fulfilled; nothing to print — reconcile by hand (refund or reprint).`)
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

  // Everything one sponsor funded prints as a single job, so it reaches the
  // reader in one parcel.
  const lineItems: LuluLineItem[] = []
  for (const item of funded) {
    const book = findBook(item.slug)
    if (!book) {
      console.error(`[sponsorship] request ${requestId} references unknown book ${item.slug}; skipping that line.`)
      continue
    }
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
    console.error(`[sponsorship] request ${requestId} produced no printable line items; skipping.`)
    return
  }

  const titles = itemTitles(funded)
  const remainingTitles = itemTitles(subtractItems(request.items, funded))

  // Nothing is printed yet, so a failure here is safe to retry.
  const job = await createPrintJob({
    externalId: session.id,
    shippingAddress,
    lineItems,
    shippingLevel: 'MAIL'
  })
  const jobId = (job as { id?: string | number }).id
  const status = (job as { status?: { name?: string } }).status?.name || 'CREATED'

  // Past this point a parcel is committed. Nothing below may throw: a retry
  // would print a second one, which is worse than any bookkeeping gap. Failures
  // are logged loudly for reconciliation by hand instead.
  try {
    await fulfilItems(request, funded, {
      sponsorEmail: session.customer_details?.email || undefined,
      stripeSessionId: session.id,
      luluJobId: jobId,
      shippingStatus: status,
      fulfilledAt: new Date().toISOString()
    })
    console.info(
      remainingTitles.length > 0
        ? `[sponsorship] request ${requestId} partly sponsored (${itemsCopies(funded)} of ${itemsCopies(request.items)} copies) via Lulu job ${jobId}; the rest stays on the board (mock=${isLuluMocked()}).`
        : `[sponsorship] request ${requestId} fulfilled via Lulu job ${jobId} (mock=${isLuluMocked()}).`)

    // Close the loop: tell the requester what's coming, thank the sponsor.
    await sendEmail(requestFulfilledEmail({
      to: request.email,
      name: request.name,
      titles,
      remainingTitles,
      city: request.address.city
    }))
    const sponsorEmail = session.customer_details?.email
    if (sponsorEmail) {
      await sendEmail(sponsorThankYouEmail({ to: sponsorEmail, titles }))
    }
  } catch (err) {
    console.error(`[sponsorship] request ${requestId} WAS PRINTED as Lulu job ${jobId} but the bookkeeping after it failed — the parcel is on its way, so reconcile the board by hand rather than re-running:`, err)
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

  const cart = parseItems(session.metadata?.cart)
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

  // Throwing is deliberate: nothing has been printed, so the caller releases
  // the claim and Stripe retries. Swallowing here is what used to lose an order
  // outright whenever Lulu had a bad minute.
  const job = await createPrintJob({
    externalId: session.id,
    shippingAddress,
    lineItems,
    shippingLevel
  })
  const job_id = (job as { id?: string | number }).id
  console.info(`[fulfilment] Lulu print job created for session ${session.id} (job ${job_id}, mock=${isLuluMocked()}).`)
}

/** Read a `[{slug, quantity}]` snapshot out of session metadata. */
function parseItems(raw: string | undefined): RequestItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
