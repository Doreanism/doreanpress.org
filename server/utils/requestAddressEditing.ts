import { destinationKey, foldOrders, type BookRequest, type RequestAddress } from './requests'
import { isOutstandingRequest } from './deliveryAddresses'
import { canEditRequestAddress } from './requestEditability'

export interface AddressEdit {
  name?: unknown
  address?: Partial<RequestAddress>
  targetRequestId?: string
  originalDestination?: { name: string, address: RequestAddress }
}

/** Resolve private address choices and combine only unfunded, account-owned requests. */
export function planAddressEdit(source: BookRequest, owned: BookRequest[], accountId: string, body: AddressEdit) {
  if (source.accountId !== accountId) throw createError({ statusCode: 403, statusMessage: 'This request belongs to another account.' })
  if (!canEditRequestAddress(source)) throw createError({ statusCode: 409, statusMessage: 'Shipped or cancelled orders cannot have their address changed.' })
  if (!body?.originalDestination?.address || destinationKey(body.originalDestination) !== destinationKey(source)) {
    throw createError({ statusCode: 409, statusMessage: 'The address changed. Refresh and try again.' })
  }
  const mine = owned.filter(request => request.accountId === accountId)
  const chosen = body.targetRequestId ? mine.find(request => request.id === body.targetRequestId && request.id !== source.id && isOutstandingRequest(request)) : undefined
  if (body.targetRequestId && !chosen) throw createError({ statusCode: 409, statusMessage: 'That order is no longer available. Refresh and choose another address.' })
  const str = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : ''
  const a = body.address
  const name = chosen?.name ?? str(body.name, 120)
  const address: RequestAddress = chosen?.address ?? {
    line1: str(a?.line1, 200), line2: str(a?.line2, 200) || undefined,
    city: str(a?.city, 120), state: str(a?.state, 120) || undefined,
    postalCode: str(a?.postalCode, 40), country: str(a?.country, 2).toUpperCase()
  }
  if (!name || !address.line1 || !address.city || !address.postalCode || !/^[A-Z]{2}$/.test(address.country)) {
    throw createError({ statusCode: 422, statusMessage: 'Enter a recipient, street address, city, postal code, and two-letter country code.' })
  }
  const destination = destinationKey({ name, address })
  // The pencil belongs to the address group: move every unshipped request there.
  const moving = [source, ...mine.filter(request => request.id !== source.id
    && destinationKey(request) === destinationKey(source) && canEditRequestAddress(request))]
  const openMoving = moving.filter(request => request.status === 'open')
  const matches = openMoving.length
    ? mine.filter(request => !moving.some(row => row.id === request.id)
      && request.status === 'open' && canEditRequestAddress(request) && destinationKey(request) === destination)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    : []
  const survivor = matches.find(request => request.id === chosen?.id) ?? matches[0] ?? openMoving[0] ?? source
  const affected = [...moving, ...matches]
  const combined = [...openMoving, ...matches].filter(request => request.id !== survivor.id)
    .reduce((order, request) => foldOrders(order, request), { items: survivor.items, message: survivor.message })
  const patch = { ...combined, name, address }
  // Funded records retain their own items and donation/fulfillment history.
  const retained = affected.filter(request => request.status !== 'open' || request.id === survivor.id)
  const changedAt = new Date().toISOString()
  const updates = retained.map(request => ({
    id: request.id,
    items: request.id === survivor.id ? patch.items : request.items,
    message: request.id === survivor.id ? patch.message : request.message,
    name, address,
    status: request.fulfillment?.amazonOrderNumber ? 'needs_attention' : request.status,
    fulfillment: { ...request.fulfillment, addressChangedAt: changedAt }
  }))
  return {
    survivor, affected, updates,
    merged: openMoving.length + matches.length > 1,
    expected: chosen && !affected.some(request => request.id === chosen.id) ? [...affected, chosen] : affected,
    patch
  }
}

/** Lock, validate and merge in one transaction, so a concurrent gift/edit loses no books. */
export async function saveAddressEdit(plan: ReturnType<typeof planAddressEdit>, accountId: string) {
  await ensureMinistrySchema()
  const sql = db()
  const affectedIds = plan.affected.map(request => request.id)
  const expected = plan.expected.map(request => ({
    id: request.id, account_id: request.accountId, status: request.status,
    items: request.items, message: request.message, name: request.name, address: request.address,
    fulfillment: request.fulfillment ?? {}
  }))
  const results = await sql.transaction([
    sql`SELECT id FROM book_requests WHERE id = ANY(${expected.map(request => request.id)}::text[]) ORDER BY id FOR UPDATE`,
    sql`WITH eligible AS (
      SELECT 1 WHERE (
        SELECT count(*) FROM book_requests r
        JOIN jsonb_array_elements(${JSON.stringify(expected)}::jsonb) e ON r.id = e->>'id'
        WHERE r.account_id = ${accountId}
          AND jsonb_build_object('id', r.id, 'account_id', r.account_id, 'status', r.status,
            'items', r.items, 'message', r.message, 'name', r.name, 'address', r.address,
            'fulfillment', r.fulfillment) = e
      ) = ${expected.length}
      AND NOT EXISTS (SELECT 1 FROM book_requests
        WHERE id = ANY(${affectedIds}::text[]) AND status = 'open' AND funded_cents > 0)
      AND NOT EXISTS (SELECT 1 FROM gift_reservations
        WHERE request_id = ANY(${affectedIds}::text[]) AND expires_at > now()
          AND request_id IN (SELECT id FROM book_requests WHERE status = 'open'))
    ), updated AS (
      UPDATE book_requests r SET items = change->'items', message = change->>'message',
        name = change->>'name', address = change->'address', status = change->>'status', fulfillment = change->'fulfillment'
      FROM jsonb_array_elements(${JSON.stringify(plan.updates)}::jsonb) change
      WHERE r.id = change->>'id' AND EXISTS (SELECT 1 FROM eligible)
      RETURNING r.id
    ), removed AS (
      DELETE FROM book_requests WHERE id = ANY(${affectedIds}::text[])
        AND id <> ALL(${plan.updates.map(request => request.id)}::text[])
        AND EXISTS (SELECT 1 FROM updated) RETURNING id
    ) SELECT id FROM updated`
  ])
  if (!results[1]?.length) throw createError({ statusCode: 409, statusMessage: 'An order changed or a giver is considering it. Refresh and try again shortly.' })
  return { id: plan.survivor.id, merged: plan.merged }
}
