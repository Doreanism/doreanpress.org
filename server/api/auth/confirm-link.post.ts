export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  const body = await readBody<{ token?: string }>(event).catch(() => null)
  const login = await consumeLoginLink(String(body?.token || ''), (await sessionAccountId(event)) || undefined)
  if (!login) {
    throw createError({ statusCode: 400, statusMessage: 'This link has expired, was already used, or belongs to a different account. To add an email, open it in the browser where you requested it.' })
  }
  if (login.accountId) {
    await requireEmailAccount(event, 'adding an email')
    await addVerifiedEmail(login.accountId, login.email)
    await claimAccountRecords(login.accountId)
    return { signedIn: await readSignedIn(event), redirect: '/profiles' }
  }
  const signedIn = await signIn(event, login.email)
  await claimAccountRecords(signedIn.accountId)
  return { signedIn, redirect: login.redirect }
})
