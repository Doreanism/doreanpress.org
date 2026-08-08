import { itemTitles } from '#shared/catalog'

// Lulu webhook receiver.
//
// Register a subscription (once, per environment) for topic
// PRINT_JOB_STATUS_CHANGED pointing at {siteUrl}/api/lulu/webhook — via the
// Lulu API (`POST /webhooks/`) or the developer dashboard. Lulu then POSTs the
// full print-job object here on every status change, signed with an
// HMAC-SHA256 of the body in the `Lulu-HMAC-SHA256` header.
//
// Both kinds of order store their Lulu job id at fulfilment time, so a status
// change is written back to whichever it belongs to and the person waiting gets
// a tracking email on SHIPPED — the reader for a sponsored request, the buyer
// for a catalog purchase. Purchases used to have no record to write back to.

/**
 * Write a status change onto a catalog purchase, mirroring what the request
 * branch does — same duplicate guard, same tracking email on SHIPPED.
 */
async function updatePurchase(
  jobId: string | number,
  statusName: string,
  job: LuluWebhookPayload['data']
) {
  const order = await findOrderByLuluJobId(jobId)
  if (!order) {
    console.info(`[lulu webhook] job ${jobId} → ${statusName} (no matching request or order).`)
    return { received: true }
  }

  if (order.shippingStatus === statusName) {
    return { received: true, duplicate: true }
  }

  const trackingUrl = statusName === 'SHIPPED'
    ? job?.line_items?.flatMap(li => li.tracking_urls || []).find(Boolean)
    : undefined

  await updateOrderShipping(order.id, { shippingStatus: statusName, trackingUrl })
  console.info(`[lulu webhook] order ${order.id} shipping status → ${statusName}.`)

  if (statusName === 'SHIPPED') {
    await sendEmail(requestShippedEmail({
      to: order.email,
      name: order.name,
      titles: itemTitles(order.items),
      trackingUrl
    }))
  }

  return { received: true }
}

interface LuluWebhookPayload {
  topic?: string
  data?: {
    id?: string | number
    external_id?: string
    status?: { name?: string, message?: string }
    line_items?: { tracking_id?: string, tracking_urls?: string[] }[]
  }
}

export default defineEventHandler(async (event) => {
  const raw = await readRawBody(event, 'utf8')
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: 'Missing request body.' })
  }

  if (!verifyLuluWebhookSignature(raw, getHeader(event, 'lulu-hmac-sha256'))) {
    console.error('[lulu webhook] signature verification failed.')
    throw createError({ statusCode: 401, statusMessage: 'Invalid signature.' })
  }

  let payload: LuluWebhookPayload
  try {
    payload = JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON body.' })
  }

  if (payload.topic !== 'PRINT_JOB_STATUS_CHANGED') {
    return { received: true }
  }

  const job = payload.data
  const jobId = job?.id
  const statusName = job?.status?.name
  if (jobId == null || !statusName) {
    return { received: true }
  }

  const request = await findRequestByLuluJobId(jobId)
  if (!request) {
    // A catalog purchase rather than a sponsored request. This branch used to
    // log "likely a direct order" and drop it, because purchases were recorded
    // nowhere to update — so the one person who paid their own money was the
    // one person never told their book had shipped.
    return updatePurchase(jobId, statusName, job)
  }

  if (request.shippingStatus === statusName) {
    return { received: true, duplicate: true }
  }

  await updateRequest(request.id, { shippingStatus: statusName })
  console.info(`[lulu webhook] request ${request.id} shipping status → ${statusName}.`)

  if (statusName === 'SHIPPED') {
    const trackingUrl = job?.line_items?.flatMap(li => li.tracking_urls || []).find(Boolean)
    await sendEmail(requestShippedEmail({
      to: request.email,
      name: request.name,
      titles: itemTitles(request.items),
      trackingUrl
    }))
  }

  return { received: true }
})
