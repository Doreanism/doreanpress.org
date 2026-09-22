export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const { accountId, email } = await requireEmailAccount(event, 'choosing a delivery address')
  await claimAccountRecords(accountId)
  const requests = await listRequestsForOwner(email, [], accountId)
  return activeDeliveryAddresses(requests, accountId)
})
