export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event)
  const admin = await requireAdministrator(event, body.action !== 'visibility' && body.action !== 'claim')
  const id = getRouterParam(event, 'id') || ''
  const sql = db()
  if (body.action === 'visibility') {
    if (typeof body.hidden !== 'boolean') throw createError({ statusCode: 422, statusMessage: 'Specify visibility.' })
    const rows = await sql`WITH changed AS (
      UPDATE book_requests SET hidden = ${body.hidden} WHERE id = ${id} RETURNING id
    ) INSERT INTO ministry_audit(account_id, request_id, action)
      SELECT ${admin.accountId}, id, ${body.hidden ? 'hide' : 'restore'} FROM changed RETURNING request_id`
    if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
    return { ok: true }
  }
  if (body.action === 'claim') {
    const rows = await sql`WITH changed AS (
      UPDATE book_requests SET fulfillment = fulfillment || jsonb_build_object('claimedBy', ${admin.accountId}::text, 'claimedAt', now()::text)
      WHERE id = ${id} AND (fulfillment->>'claimedBy' IS NULL OR fulfillment->>'claimedBy' = ${admin.accountId}) RETURNING id
    ) INSERT INTO ministry_audit(account_id, request_id, action)
      SELECT ${admin.accountId}, id, 'claim' FROM changed RETURNING request_id`
    if (!rows.length) throw createError({ statusCode: 409, statusMessage: 'Task is already claimed or no longer exists.' })
    return { ok: true }
  }
  const request = await getRequest(id)
  if (!request) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  if (request.fulfillment?.claimedBy !== admin.accountId) throw createError({ statusCode: 409, statusMessage: 'Claim this task before changing fulfillment.' })
  if (body.action === 'instructions' || body.action === 'address') {
    if (body.action === 'instructions' && body.authorize === true && Number(body.maximumCents) !== request.fulfillment?.maximumCents) {
      throw createError({ statusCode: 409, statusMessage: 'Save the displayed spending limit before authorizing a purchase.' })
    }
    await auditMinistry(admin.accountId, id, body.action === 'address' ? 'copy_address' : body.authorize === true ? 'copy_authorized_task' : 'copy_preview')
    return { text: body.action === 'address'
      ? [request.name, request.address.line1, request.address.line2, `${request.address.city}, ${request.address.state || ''} ${request.address.postalCode}`, request.address.country, request.phone].filter(Boolean).join('\n')
      : agentInstructions(request, body.authorize === true) }
  }
  const next = fulfillmentPatch(request, body, admin.accountId)
  // Compare-and-swap prevents stale forms overwriting another admin action.
  const rows = await sql`WITH changed AS (
    UPDATE book_requests SET status = ${next.status}, fulfillment = ${JSON.stringify(next.fulfillment)}::jsonb
    WHERE id = ${id} AND status = ${request.status} AND fulfillment = ${JSON.stringify(request.fulfillment || {})}::jsonb
    RETURNING id, email
  ), audited AS (
    INSERT INTO ministry_audit(account_id, request_id, action)
    SELECT ${admin.accountId}, id, ${String(body.action)} FROM changed
  ), notified AS (
    INSERT INTO ministry_outbox(id, recipient, subject, body)
    SELECT ${crypto.randomUUID()}, email, 'Your Dorean Press request',
      ${`Your request is ${next.status.replaceAll('_', ' ')}.${next.fulfillment.recipientTrackingUrl ? `\nTrack your parcel: ${next.fulfillment.recipientTrackingUrl}` : ''}\nView your request at ${useRuntimeConfig().public.siteUrl}/orders`}
    FROM changed WHERE ${['ordered', 'tracking', 'needs_attention', 'cancelled'].includes(String(body.action))}
  ) SELECT id FROM changed`
  if (!rows.length) throw createError({ statusCode: 409, statusMessage: 'Task changed. Refresh before trying again.' })
  if (['tracking', 'carrier'].includes(String(body.action)) && next.fulfillment.trackingNumber) await registerRequestTracker(id)
  await flushMinistryEmails()
  return { ok: true }
})
