export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const account = await requireEmailAccount(event, 'managing email addresses')
  return { emails: await accountEmails(account.accountId) }
})
