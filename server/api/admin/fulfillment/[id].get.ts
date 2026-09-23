export default defineEventHandler(async (event) => {
  const admin = await requireAdministrator(event)
  const id = getRouterParam(event, 'id') || ''
  const request = await getRequest(id)
  if (!request) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  await auditMinistry(admin.accountId, id, 'view_address')
  const [funding] = await db()`SELECT sum(COALESCE(allocated_cents, amount_cents)) AS cents
    FROM ministry_gifts WHERE request_id = ${id} AND allocation = 'request'`
  return { ...fulfillmentSummary(request), items: request.items, name: request.name,
    fundedCents: funding?.cents != null ? Number(funding.cents) : request.fundedCents || 0,
    phone: request.phone, address: request.address, fulfillment: request.fulfillment }
})
