import { createHmac, timingSafeEqual } from 'node:crypto'
import { estimateGift } from '#shared/giftEstimate'
import type { RequestItem } from '#shared/catalog'
import { normalizeGiftCode } from '#shared/giftCode'

export function verifyZeffySignature(raw: string, header: string, secret: string, now = Date.now()) {
  if (!secret) return false
  const values = Object.fromEntries(header.split(',').map(part => part.trim().split('=')))
  const timestamp = Number(values.t)
  if (!Number.isFinite(timestamp) || Math.abs(now / 1000 - timestamp) > 300 || !/^[a-f0-9]{64}$/i.test(values.v1 || '')) return false
  const expected = createHmac('sha256', secret).update(`${values.t}.${raw}`).digest()
  return timingSafeEqual(expected, Buffer.from(values.v1!, 'hex'))
}

export interface ZeffyPaymentEvent {
  id: string
  type: string
  version: number
  data: {
    id: string
    status: string
    amount: number
    currency: string
    campaign_id: string
    buyer?: { email?: string }
    receipt_url?: string
    buyer_questions?: { question: string, answer: unknown }[]
  }
}

export async function recordZeffyGift(event: ZeffyPaymentEvent) {
  const config = useRuntimeConfig().zeffy
  const payment = event.data
  if (event.type !== 'payment.completed') return
  if (event.version !== 1 || !event.id || !payment?.id || payment.status !== 'succeeded'
    || !Number.isSafeInteger(payment.amount) || payment.amount <= 0 || payment.currency !== 'usd') {
    throw createError({ statusCode: 422, statusMessage: 'Unsupported Zeffy payment.' })
  }
  if (payment.campaign_id !== config.campaignId) return
  const answer = payment.buyer_questions?.find(q => [config.recommendationQuestion, 'Dorean Press request code', 'Dorean Press recommendation code'].includes(q.question))?.answer
  const reservationId = typeof answer === 'string' ? normalizeGiftCode(answer) : ''
  const donorEmail = typeof payment.buyer?.email === 'string' ? payment.buyer.email.slice(0, 320) : ''
  const receipt = typeof payment.receipt_url === 'string' && /^https:\/\/(www\.)?zeffy\.com\//.test(payment.receipt_url) ? payment.receipt_url : null
  await ensureMinistrySchema()
  const sql = db()
  // Older codes predate stored targets. Use their whole request's estimate.
  const original = await sql`SELECT r.items, r.address FROM book_requests r
    JOIN gift_reservations g ON g.request_id = r.id WHERE g.id = ${reservationId}`
  const rates = useRuntimeConfig().giftEstimate
  const legacyTarget = original[0]
    ? estimateGift(original[0].items as RequestItem[],
        Number(rates?.firstCopyCents), Number(rates?.additionalCopyCents), (original[0].address as { country: string }).country)
    : null
  // A row lock serializes reservations, gift allocation, and edits for this request.
  // All payment writes and notifications commit together. Duplicate event/payment
  // ids do nothing, including when two webhook attempts arrive simultaneously.
  await sql.transaction([
    sql`SELECT id FROM book_requests WHERE id = (SELECT request_id FROM gift_reservations WHERE id = ${reservationId}) FOR UPDATE`,
    sql`WITH eligible AS (
      SELECT r.id, r.funded_cents,
        COALESCE(r.funding_target_cents, reservation.target_cents, ${legacyTarget}::integer) AS target
      FROM book_requests r JOIN gift_reservations reservation ON reservation.request_id = r.id
      -- The browsing lease never determines whether a completed gift is valid.
      WHERE reservation.id = ${reservationId} AND r.status = 'open' AND NOT r.hidden
        AND r.items = COALESCE(reservation.original_items, reservation.items)
    ), allocation AS (
      SELECT id, target, LEAST(${payment.amount}, GREATEST(0, target - funded_cents)) AS credited
      FROM eligible WHERE target > 0
    ), gift AS (
      INSERT INTO ministry_gifts(payment_id, event_id, amount_cents, currency, donor_email, receipt_url,
        recommendation_id, request_id, allocation, allocated_cents)
      VALUES (${payment.id}, ${event.id}, ${payment.amount}, ${payment.currency}, ${donorEmail || null}, ${receipt},
        ${reservationId || null}, (SELECT id FROM allocation WHERE credited > 0),
        CASE WHEN EXISTS(SELECT 1 FROM allocation WHERE credited > 0) THEN 'request' ELSE 'general' END,
        COALESCE((SELECT credited FROM allocation), 0))
      ON CONFLICT DO NOTHING RETURNING payment_id, request_id, allocated_cents
    ), credited AS (
      UPDATE book_requests r SET funded_cents = r.funded_cents + gift.allocated_cents,
        funding_target_cents = allocation.target,
        status = CASE WHEN r.funded_cents + gift.allocated_cents >= allocation.target
          THEN 'funded_awaiting_order' ELSE 'open' END,
        fulfillment = CASE WHEN r.funded_cents + gift.allocated_cents >= allocation.target
          THEN fulfillment || jsonb_build_object('fundedAt', now()::text) ELSE fulfillment END
      FROM gift, allocation WHERE r.id = gift.request_id AND r.id = allocation.id
      RETURNING r.id, r.status
    ), donor_notice AS (
      INSERT INTO ministry_outbox(id, recipient, subject, body)
      SELECT 'gift:' || payment_id, ${donorEmail}, 'Thank you for your gift to Dorean Press',
        CASE WHEN EXISTS(SELECT 1 FROM credited WHERE status = 'funded_awaiting_order')
          THEN 'Your gift helped fully fund the request, which is now awaiting an author-copy order.'
          WHEN allocated_cents > 0 THEN 'Your gift was added to this request. It remains open while other donors help fund the remaining cost.'
          ELSE 'Your gift was received into the general Give a Book balance. The request code could not be applied to an eligible open request.' END
        || CASE WHEN allocated_cents > 0 AND allocated_cents < ${payment.amount}
          THEN ' The amount above the remaining cost went to the general fund.' ELSE '' END
        || ' Dorean Press retains control and discretion over every gift. No goods or services are provided to you. Zeffy provides your receipt.'
      FROM gift WHERE ${Boolean(donorEmail)}
    ) INSERT INTO ministry_outbox(id, recipient, subject, body)
      SELECT 'task:' || id, ${pressEmailAddress()}, 'Dorean Press ordering task',
        'A fully funded request is ready for manual KDP author-copy ordering: ' || ${useRuntimeConfig().public.siteUrl + '/admin/fulfillment'}
      FROM credited WHERE status = 'funded_awaiting_order' AND ${Boolean(pressEmailAddress())}`
  ])
}
