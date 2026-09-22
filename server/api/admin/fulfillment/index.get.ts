export default defineEventHandler(async (event) => {
  await requireAdministrator(event)
  const query = getQuery(event)
  const status = String(query.status || 'funded_awaiting_order')
  const page = Math.max(0, Math.min(100000, Math.floor(Number(query.page) || 0)))
  const visibility = String(query.visibility || 'all')
  const rows = await db()`SELECT id FROM book_requests
    WHERE (${status} = 'all' OR status = ${status})
    AND (${visibility} = 'all' OR hidden = ${visibility === 'hidden'})
    ORDER BY COALESCE(fulfillment->>'fundedAt', created_at) ASC LIMIT 200 OFFSET ${page * 200}`
  const requests = await Promise.all(rows.map(row => getRequest(String(row.id))))
  return requests.filter(r => r !== null).map(fulfillmentSummary)
})
