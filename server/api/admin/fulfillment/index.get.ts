import { requestFromRow } from '../../../utils/requests'

export default defineEventHandler(async (event) => {
  await requireAdministrator(event)
  const query = getQuery(event)
  const status = String(query.status || 'pending')
  const page = Math.max(0, Math.min(100000, Math.floor(Number(query.page) || 0)))
  const visibility = String(query.visibility || 'all')
  const rows = await db()`SELECT r.*, a.email AS claimed_email FROM book_requests r
    LEFT JOIN reader_accounts a ON a.id = r.fulfillment->>'claimedBy'
    WHERE (${status} = 'all' OR r.status = ${status}
      OR (${status} = 'pending' AND r.status IN ('funded_awaiting_order', 'ordered', 'needs_attention')))
    AND (${visibility} = 'all' OR r.hidden = ${visibility === 'hidden'})
    ORDER BY COALESCE(r.fulfillment->>'fundedAt', r.created_at) ASC LIMIT 200 OFFSET ${page * 200}`
  return rows.map(row => ({ ...fulfillmentSummary(requestFromRow(row)), claimedEmail: (row.claimed_email as string) || null }))
})
