import { itemTitles } from '#shared/catalog'

// Lulu webhook receiver.
//
// Register a subscription (once, per environment) for topic
// PRINT_JOB_STATUS_CHANGED pointing at {siteUrl}/api/lulu/webhook — via the
// Lulu API (`POST /webhooks/`) or the developer dashboard. Lulu then POSTs the
// full print-job object here on every status change, signed with an
// HMAC-SHA256 of the body in the `Lulu-HMAC-SHA256` header.
//
// Sponsorship requests store their Lulu job id at fulfilment time, so status
// changes are written back to the request (and the requester gets a tracking
// email on SHIPPED). Direct store orders have no persisted record — those are
// just logged.

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
    console.info(`[lulu webhook] job ${jobId} → ${statusName} (no matching request; likely a direct order).`)
    return { received: true }
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
