import type { RequestItem } from '#shared/catalog'
import { estimateGift } from '#shared/giftEstimate'
import { newGiftCode } from '#shared/giftCode'

export default defineEventHandler(async (event) => {
  const runtime = useRuntimeConfig()
  const config = runtime.zeffy
  if (!config.campaignUrl || !config.campaignId || !config.webhookSecret) {
    throw createError({ statusCode: 503, statusMessage: 'Donations are not yet available. Please check back soon.' })
  }
  const url = new URL(config.campaignUrl)
  if (url.protocol !== 'https:' || !['www.zeffy.com', 'zeffy.com'].includes(url.hostname)) throw createError({ statusCode: 503, statusMessage: 'Donation campaign is not configured correctly.' })
  const id = getRouterParam(event, 'id') || ''
  await ensureMinistrySchema()
  const request = await getRequest(id)
  if (!request || request.hidden || request.status !== 'open') throw createError({ statusCode: 404, statusMessage: 'Request unavailable.' })
  const target = request.fundingTargetCents ?? estimateGift(request.items, Number(runtime.giftEstimate?.firstCopyCents), Number(runtime.giftEstimate?.additionalCopyCents), request.address.country)
  if (!target) throw createError({ statusCode: 422, statusMessage: 'This request needs a shipping estimate before it can receive gifts.' })
  const sql = db()
  const cookieName = `gift-${id}`
  const previousId = getCookie(event, cookieName)
  const checkout = (reservation: { id: string, expires_at: unknown, items: RequestItem[], target_cents?: number }, resumed: boolean) => {
    const savedTarget = request.fundingTargetCents ?? reservation.target_cents ?? target
    return ({
      id: reservation.id, url: url.href, embed: url.pathname.startsWith('/embed/'),
      items: request.items,
      targetCents: savedTarget, fundedCents: request.fundedCents || 0,
      estimatedCents: Math.max(0, savedTarget - (request.fundedCents || 0)),
      recommendation: reservation.id, question: config.recommendationQuestion,
      expiresAt: new Date(reservation.expires_at as string).toISOString(), resumed
    })
  }
  if (previousId) {
    const previous = await sql`SELECT reservation.id, reservation.expires_at, reservation.items, reservation.target_cents
      FROM gift_reservations reservation JOIN book_requests r ON r.id = reservation.request_id
      WHERE reservation.id = ${previousId} AND reservation.request_id = ${id}
        AND reservation.expires_at > now() AND r.status = 'open' AND NOT r.hidden
        AND r.items = COALESCE(reservation.original_items, reservation.items)`
    if (previous[0]) return checkout(previous[0] as { id: string, expires_at: unknown, items: RequestItem[], target_cents?: number }, true)
  }
  // The reservation id is the code donors type into Zeffy. A repeated code hits
  // the primary key; draw again rather than failing the donor.
  const reserve = async () => {
    for (let attempt = 0; ; attempt++) {
      const code = newGiftCode()
      try {
        return { reservationId: code, results: await sql.transaction([
          sql`SELECT id FROM book_requests WHERE id = ${id} FOR UPDATE`,
          sql`INSERT INTO gift_reservations(id, request_id, items, original_items, expires_at, target_cents)
            SELECT ${code}, id, items, items, now() + interval '3 minutes', ${target} FROM book_requests
            WHERE id = ${id} AND status = 'open' AND NOT hidden AND items = ${JSON.stringify(request.items)}::jsonb
            RETURNING id, expires_at, items, target_cents`
        ]) }
      } catch (error) {
        if ((error as { code?: string }).code !== '23505' || attempt >= 2) throw error
      }
    }
  }
  const { reservationId, results } = await reserve()
  if (!results[1]!.length) throw createError({ statusCode: 409, statusMessage: 'This request changed or is already funded. Refresh and try again.' })
  // Zeffy's metadata is reserved for future use. A configured checkout question
  // transports the recommendation explicitly; do not invent URL metadata support.
  // An embed URL (zeffy.com/embed/…) is shown inside the page; a campaign URL opens on Zeffy.
  setCookie(event, cookieName, reservationId, {
    httpOnly: true, sameSite: 'lax', secure: !import.meta.dev, path: '/api/requests', maxAge: 24 * 60 * 60
  })
  return checkout(results[1]![0] as { id: string, expires_at: unknown, items: RequestItem[], target_cents?: number }, false)
})
