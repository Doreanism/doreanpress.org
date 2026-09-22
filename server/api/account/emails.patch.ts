export default defineEventHandler(async (event) => {
  const account = await requireEmailAccount(event, 'changing your primary email')
  const body = await readBody<{ email?: string }>(event)
  await claimAccountRecords(account.accountId)
  await setPrimaryEmail(account.accountId, body?.email || '')
  return { emails: await accountEmails(account.accountId) }
})
