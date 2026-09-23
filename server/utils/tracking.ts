import { createHmac, timingSafeEqual } from 'node:crypto'

interface Tracker {
  id: string
  status: string
  updated_at: string
  carrier: string
  tracking_code: string
}

export function verifyTrackingSignature(raw: string, header: string, secret: string) {
  if (!secret) return false
  const corrected = raw.replace(/("weight":\s*)(\d+)(\s*)(?=,|\})/g, '$1$2.0')
  const expected = 'hmac-sha256-hex=' + createHmac('sha256', secret.normalize('NFKD')).update(corrected).digest('hex')
  return header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected))
}

async function trackingApi(path: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', body?: Record<string, unknown>) {
  return await $fetch<Tracker>(`https://api.easypost.com/v2${path}`, {
    method, body, headers: { Authorization: `Basic ${Buffer.from(useRuntimeConfig().easypost.apiKey + ':').toString('base64')}` }
  })
}

export async function registerRequestTracker(id: string) {
  if (!useRuntimeConfig().easypost.apiKey) return
  await ensureMinistrySchema()
  const sql = db()
  const claimed = await sql`UPDATE book_requests SET tracker_lease_until = now() + interval '5 minutes'
    WHERE id = ${id} AND fulfillment->>'trackingNumber' IS NOT NULL AND fulfillment->>'carrier' IS NOT NULL
      AND fulfillment->>'trackerId' IS NULL AND (tracker_lease_until IS NULL OR tracker_lease_until < now())
    RETURNING fulfillment`
  if (!claimed.length) return
  const f = claimed[0]!.fulfillment
  try {
    // EasyPost deduplicates identical carrier/code pairs for three months,
    // making a retry safe if a process dies after creation but before storing id.
    const tracker = await trackingApi('/trackers', 'POST', { tracker: { carrier: f.carrier, tracking_code: f.trackingNumber } })
    await sql`UPDATE book_requests SET fulfillment = fulfillment || jsonb_build_object('trackerId', ${tracker.id}::text), tracker_lease_until = NULL
      WHERE id = ${id} AND fulfillment->>'trackingNumber' = ${f.trackingNumber} AND fulfillment->>'carrier' = ${f.carrier}`
    await applyTrackingEvent(`initial:${tracker.id}`, tracker)
  } catch {
    await sql`UPDATE book_requests SET tracker_lease_until = NULL WHERE id = ${id}`
    // The ordering task remains done. The maintenance endpoint retries registration.
  }
}

export function deliveryStatus(status: string) {
  if (['failure', 'error'].includes(status)) return 'exception'
  if (status === 'return_to_sender') return 'returned'
  return ['unknown', 'pre_transit', 'in_transit', 'out_for_delivery', 'delivered', 'available_for_pickup', 'cancelled'].includes(status) ? status : 'unknown'
}

export async function applyTrackingEvent(eventId: string, tracker: Tracker) {
  if (!eventId || !tracker?.id || !Number.isFinite(Date.parse(tracker.updated_at))) throw createError({ statusCode: 422, statusMessage: 'Invalid tracking event.' })
  await ensureMinistrySchema()
  const sql = db()
  const status = deliveryStatus(tracker.status)
  await sql.transaction([
    sql`SELECT id FROM book_requests WHERE fulfillment->>'trackerId' = ${tracker.id} FOR UPDATE`,
    sql`WITH previous AS (SELECT id, fulfillment->>'deliveryStatus' AS old_status FROM book_requests WHERE fulfillment->>'trackerId' = ${tracker.id}), recorded AS (
      INSERT INTO ministry_tracking_events(id, tracker_id, status, occurred_at)
      VALUES (${eventId}, ${tracker.id}, ${status}, ${tracker.updated_at}::timestamptz)
      ON CONFLICT DO NOTHING RETURNING id
    ), changed AS (
      UPDATE book_requests SET fulfillment = fulfillment || jsonb_build_object('deliveryStatus', ${status}::text, 'deliveryUpdatedAt', ${tracker.updated_at}::text)
        || CASE WHEN ${['in_transit', 'out_for_delivery', 'delivered', 'available_for_pickup', 'returned'].includes(status)}
          THEN jsonb_build_object('shippedAt', COALESCE(fulfillment->>'shippedAt', ${tracker.updated_at}::text))
          ELSE '{}'::jsonb END
      FROM previous WHERE book_requests.id = previous.id AND fulfillment->>'trackerId' = ${tracker.id} AND EXISTS(SELECT 1 FROM recorded)
        AND COALESCE((fulfillment->>'deliveryUpdatedAt')::timestamptz, '-infinity'::timestamptz) < ${tracker.updated_at}::timestamptz
      RETURNING book_requests.id, email, book_requests.account_id, previous.old_status
    ) INSERT INTO ministry_outbox(id, recipient, subject, account_id, body)
      SELECT 'tracking:' || ${eventId} || ':' || id, email, 'Your Dorean Press delivery', account_id,
        ${`Your delivery status is ${status.replaceAll('_', ' ')}. View your private tracking details at ${useRuntimeConfig().public.siteUrl}/orders`}
      FROM changed WHERE old_status IS DISTINCT FROM ${status} AND ${['in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned', 'available_for_pickup'].includes(status)}`
  ])
}

export async function reconcileTracking() {
  if (!useRuntimeConfig().easypost.apiKey) return
  const sql = db()
  const pending = await sql`SELECT id FROM book_requests WHERE fulfillment->>'trackingNumber' IS NOT NULL
    AND fulfillment->>'trackerId' IS NULL AND status = 'done' LIMIT 100`
  for (const row of pending) await registerRequestTracker(String(row.id))
  const rows = await sql`SELECT id, fulfillment FROM book_requests WHERE fulfillment->>'trackerId' IS NOT NULL
    AND COALESCE((fulfillment->>'deliveryUpdatedAt')::timestamptz, '-infinity'::timestamptz) < now() - interval '1 day' LIMIT 100`
  for (const row of rows) {
    const f = row.fulfillment
    if (!/^trk_[A-Za-z0-9]+$/.test(f.trackerId)) continue
    const terminal = ['delivered', 'returned', 'cancelled'].includes(f.deliveryStatus)
    if (terminal) {
      if (Date.parse(f.deliveryUpdatedAt) < Date.now() - 7 * 86400000) {
        await trackingApi(`/trackers/${f.trackerId}`, 'DELETE')
        await sql`UPDATE book_requests SET fulfillment = (fulfillment - 'trackerId' - 'trackingNumber')
          WHERE id = ${row.id} AND fulfillment->>'trackerId' = ${f.trackerId}`
      }
      continue
    }
    const tracker = await trackingApi(`/trackers/${f.trackerId}`)
    await applyTrackingEvent(`poll:${tracker.id}:${tracker.updated_at}`, tracker)
  }
  await sql`DELETE FROM ministry_tracking_events WHERE occurred_at < now() - interval '90 days'`
}
