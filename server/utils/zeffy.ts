import { createHmac, timingSafeEqual } from 'node:crypto'

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
  const answer = payment.buyer_questions?.find(q => q.question === config.recommendationQuestion)?.answer
  const reservationId = typeof answer === 'string' ? answer.trim() : ''
  const donorEmail = typeof payment.buyer?.email === 'string' ? payment.buyer.email.slice(0, 320) : ''
  const receipt = typeof payment.receipt_url === 'string' && /^https:\/\/(www\.)?zeffy\.com\//.test(payment.receipt_url) ? payment.receipt_url : null
  await ensureMinistrySchema()
  const sql = db()
  // A row lock serializes reservations, gift allocation, and edits for this request.
  // All payment writes and notifications commit together. Duplicate event/payment
  // ids do nothing, including when two webhook attempts arrive simultaneously.
  await sql.transaction([
    sql`SELECT id FROM book_requests WHERE id = (SELECT request_id FROM gift_reservations WHERE id = ${reservationId}) FOR UPDATE`,
    sql`WITH eligible AS (
      SELECT r.id, reservation.items AS chosen FROM book_requests r JOIN gift_reservations reservation ON reservation.request_id = r.id
      WHERE reservation.id = ${reservationId} AND reservation.expires_at > now()
        AND r.status = 'open' AND NOT r.hidden AND r.items = COALESCE(reservation.original_items, reservation.items)
    ), gift AS (
      INSERT INTO ministry_gifts(payment_id, event_id, amount_cents, currency, donor_email, receipt_url, recommendation_id, request_id, allocation)
      VALUES (${payment.id}, ${event.id}, ${payment.amount}, ${payment.currency}, ${donorEmail || null}, ${receipt}, ${reservationId || null},
        (SELECT id FROM eligible), CASE WHEN EXISTS(SELECT 1 FROM eligible) THEN 'request' ELSE 'general' END)
      ON CONFLICT DO NOTHING RETURNING payment_id, request_id
    ), remainder AS (
      INSERT INTO book_requests (id, items, message, requester, requesters, account_key, name, email, phone, address, status, created_at, hidden, account_id)
      SELECT ${crypto.randomUUID()}, remaining.items, r.message, r.requester, r.requesters, r.account_key,
        r.name, r.email, r.phone, r.address, 'open', r.created_at, r.hidden, r.account_id
      FROM book_requests r JOIN gift ON gift.request_id = r.id JOIN eligible ON eligible.id = r.id
      CROSS JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('slug', line->>'slug', 'quantity', (line->>'quantity')::integer - COALESCE((selected.chosen->>'quantity')::integer, 0))) AS items
        FROM jsonb_array_elements(r.items) line
        LEFT JOIN LATERAL (SELECT value AS chosen FROM jsonb_array_elements(eligible.chosen) WHERE value->>'slug' = line->>'slug') selected ON true
        WHERE (line->>'quantity')::integer > COALESCE((selected.chosen->>'quantity')::integer, 0)
      ) remaining WHERE remaining.items IS NOT NULL
    ), funded AS (
      UPDATE book_requests r SET status = 'funded_awaiting_order', items = eligible.chosen, sponsor_email = ${donorEmail || null},
        fulfillment = fulfillment || jsonb_build_object('fundedAt', now()::text)
      FROM gift, eligible WHERE r.id = gift.request_id AND r.id = eligible.id RETURNING r.id
    ), donor_notice AS (
      INSERT INTO ministry_outbox(id, recipient, subject, body)
      SELECT 'gift:' || payment_id, ${donorEmail}, 'Thank you for your gift to Dorean Press',
        CASE WHEN EXISTS(SELECT 1 FROM funded)
          THEN 'Your gift was received, and your recommended request is awaiting an author-copy order.'
          ELSE 'Your gift was received into the general Give a Book balance. Your recommendation could not be applied to an eligible open request.' END
        || ' Gifts are to Lakewood Village Baptist Church for the Dorean Press ministry. The church retains control and discretion over every gift. No goods or services are provided to you. Zeffy provides your receipt.'
      FROM gift WHERE ${Boolean(donorEmail)}
    ) INSERT INTO ministry_outbox(id, recipient, subject, body)
      SELECT 'task:' || id, ${pressEmailAddress()}, 'Dorean Press ordering task',
        'A funded request is ready for manual KDP author-copy ordering: ' || ${useRuntimeConfig().public.siteUrl + '/admin/fulfillment'}
      FROM funded WHERE ${Boolean(pressEmailAddress())}`
  ])
}
