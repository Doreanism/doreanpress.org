export default defineEventHandler(async (event) => {
  const account = await requireEmailAccount(event, 'changing your primary profile')
  const body = await readBody<{ account?: string }>(event)
  if (typeof body?.account !== 'string' || !body.account) {
    throw createError({ statusCode: 400, statusMessage: 'Choose an attached profile.' })
  }
  await setPrimaryIdentity(account.accountId, body.account)
  return { ok: true }
})
