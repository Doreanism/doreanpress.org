import { planAddressEdit, saveAddressEdit, type AddressEdit } from '../../../utils/requestAddressEditing'

export default defineEventHandler(async (event) => {
  const { accountId, email } = await requireSignedIn(event, 'editing your delivery address')
  await claimAccountRecords(accountId)
  const id = getRouterParam(event, 'id') || ''
  const source = await getRequest(id)
  if (!source) throw createError({ statusCode: 404, statusMessage: 'This request no longer exists.' })
  const body = await readBody<AddressEdit>(event)
  const owned = await listRequestsForOwner(email, [], accountId)
  return saveAddressEdit(planAddressEdit(source, owned, accountId, body), accountId)
})
