import { toGivenView } from '../utils/orderViews'

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const { email, accountId } = await requireSignedIn(event, 'seeing your gifts')
  await claimAccountRecords(accountId)
  const sponsored = await listRequestsSponsoredBy(email || '', accountId)
  return sponsored.map(toGivenView)
})
