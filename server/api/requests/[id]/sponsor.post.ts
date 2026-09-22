import { limitItems, type RequestItem } from '#shared/catalog'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig().zeffy
  if (!config.campaignUrl || !config.campaignId || !config.webhookSecret) {
    throw createError({ statusCode: 503, statusMessage: 'Donations are not yet available. Please check back soon.' })
  }
  const url = new URL(config.campaignUrl)
  if (url.protocol !== 'https:' || !['www.zeffy.com', 'zeffy.com'].includes(url.hostname)) throw createError({ statusCode: 503, statusMessage: 'Donation campaign is not configured correctly.' })
  const id = getRouterParam(event, 'id') || ''
  await ensureMinistrySchema()
  const request = await getRequest(id)
  if (!request || request.hidden || request.status !== 'open') throw createError({ statusCode: 404, statusMessage: 'Request unavailable.' })
  const body = await readBody<{ items?: RequestItem[] }>(event)
  const chosen = Array.isArray(body?.items) ? limitItems(request.items, body.items) : request.items
  if (!chosen.length) throw createError({ statusCode: 422, statusMessage: 'Choose at least one book.' })
  const sql = db()
  const reservationId = crypto.randomUUID()
  const results = await sql.transaction([
    sql`SELECT id FROM book_requests WHERE id = ${id} FOR UPDATE`,
    sql`INSERT INTO gift_reservations(id, request_id, items, original_items, expires_at)
      SELECT ${reservationId}, id, ${JSON.stringify(chosen)}::jsonb, items, now() + interval '30 minutes' FROM book_requests
      WHERE id = ${id} AND status = 'open' AND NOT hidden AND items = ${JSON.stringify(request.items)}::jsonb
        AND NOT EXISTS(SELECT 1 FROM gift_reservations WHERE request_id = ${id} AND expires_at > now())
      RETURNING id`
  ])
  if (!results[1]!.length) throw createError({ statusCode: 409, statusMessage: 'This request is unavailable or another donor is considering it. Please choose another request or try later.' })
  // Zeffy's metadata is reserved for future use. A configured checkout question
  // transports the recommendation explicitly; do not invent URL metadata support.
  return { id: reservationId, url: url.href, recommendation: reservationId, question: config.recommendationQuestion }
})
