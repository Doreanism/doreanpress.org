// Hand back the code and be signed in.
//
// The failures here describe the *code*, never the address: "that code has
// expired" is worth saying because it tells the reader to ask for another, and
// it is true of a code we never sent as readily as one we did.

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, code?: string }>(event)
    .catch(() => ({} as { email?: string, code?: string }))

  const email = normalizeEmail(body?.email || '')
  const code = String(body?.code || '').trim()

  if (!email || !code) {
    throw createError({ statusCode: 400, statusMessage: 'Enter the code we emailed you.' })
  }

  const result = await checkLoginCode(email, code)

  if (result === 'expired') {
    throw createError({ statusCode: 400, statusMessage: 'That code has expired. Ask for a new one.' })
  }
  if (result === 'too-many-attempts') {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many tries. Ask for a new code.'
    })
  }
  if (result !== 'ok') {
    throw createError({ statusCode: 400, statusMessage: 'That code is not right.' })
  }

  const signedIn = await signIn(event, email)
  return { signedIn }
})
