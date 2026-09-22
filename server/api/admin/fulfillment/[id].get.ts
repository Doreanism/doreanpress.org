export default defineEventHandler(async (event) => {
  const admin = await requireAdministrator(event, true)
  const id = getRouterParam(event, 'id') || ''
  const request = await getRequest(id)
  if (!request) throw createError({ statusCode: 404, statusMessage: 'Order not found.' })
  await auditMinistry(admin.accountId, id, 'view_address')
  return { ...fulfillmentSummary(request), items: request.items, name: request.name,
    phone: request.phone, address: request.address, fulfillment: request.fulfillment }
})
