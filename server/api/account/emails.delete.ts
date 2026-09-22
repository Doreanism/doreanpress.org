export default defineEventHandler(async (event) => {
  const account = await requireEmailAccount(event, 'removing an email')
  const body = await readBody<{ email?: string }>(event)
  await claimAccountRecords(account.accountId)
  await removeAccountEmail(account.accountId, body?.email || '')
  return { emails: await accountEmails(account.accountId) }
})
