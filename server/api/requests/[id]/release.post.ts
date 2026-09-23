// A closing page releases only the exact reservation held by this browser.
// Serialize with renewal and payment allocation so an in-flight heartbeat cannot
// revive the reservation after release.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  const reservationId = getCookie(event, `gift-${id}`)
  const body = await readBody<{ recommendation?: string }>(event)
  if (!reservationId || body?.recommendation !== reservationId) {
    throw createError({ statusCode: 403, statusMessage: 'This gift reservation belongs to another browser session.' })
  }
  await ensureMinistrySchema()
  const sql = db()
  await sql.transaction([
    sql`SELECT id FROM book_requests WHERE id = ${id} FOR UPDATE`,
    sql`UPDATE gift_reservations SET expires_at = now()
      WHERE id = ${reservationId} AND request_id = ${id} AND expires_at > now()`
  ])
  return { released: true }
})
