// Ask for a sign-in code.
//
// The answer is the same whatever happens: address we have never seen, address
// with fifty orders, address that has asked four times in the last minute. Any
// difference here — a different message, a different status, a noticeably
// different response time — turns this endpoint into a way to ask "does this
// person use Dorean Press", which is a question about a stranger's reading that
// nobody should be able to put to us.
//
// That includes the rate limit. When an address has asked too often we stop
// sending, and say exactly what we say when we did send.

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string }>(event).catch(() => ({} as { email?: string }))
  const email = normalizeEmail(body?.email || '')

  // The one thing worth refusing out loud, because it is about what the reader
  // typed rather than about who they are.
  if (!email || !email.includes('@') || email.length > 320) {
    throw createError({ statusCode: 400, statusMessage: 'Please enter an email address.' })
  }

  const code = await issueLoginCode(email)
  if (code) {
    await sendEmail(signInCodeEmail({ to: email, code, minutes: 10 }))
  }

  return { sent: true }
})
