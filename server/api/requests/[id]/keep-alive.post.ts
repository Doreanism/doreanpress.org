// Renew only a live reservation owned by this browser. Never revive an expired
// code: another donor may already have started checkout for the same books.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  const reservationId = getCookie(event, `gift-${id}`)
  const body = await readBody<{ recommendation?: string }>(event)
  if (!reservationId || body?.recommendation !== reservationId) {
    throw createError({ statusCode: 403, statusMessage: 'This gift reservation belongs to another browser session.' })
  }
  await ensureMinistrySchema()
  const sql = db()
  const results = await sql.transaction([
    sql`SELECT id FROM book_requests WHERE id = ${id} FOR UPDATE`,
    sql`UPDATE gift_reservations reservation SET expires_at = now() + interval '3 minutes'
      FROM book_requests r
      WHERE reservation.id = ${reservationId} AND reservation.request_id = ${id} AND r.id = ${id}
        AND reservation.expires_at > now() AND r.status = 'open' AND NOT r.hidden
        AND r.items = COALESCE(reservation.original_items, reservation.items)
      RETURNING reservation.expires_at, COALESCE(r.funding_target_cents, reservation.target_cents) AS target_cents, r.funded_cents`
  ])
  const reservation = results[1]?.[0]
  if (!reservation) {
    throw createError({ statusCode: 409, statusMessage: 'This reservation has ended or the request is no longer available.' })
  }
  return { targetCents: (reservation.target_cents as number) ?? null, fundedCents: (reservation.funded_cents as number) || 0, expiresAt: new Date(reservation.expires_at as string).toISOString() }
})
