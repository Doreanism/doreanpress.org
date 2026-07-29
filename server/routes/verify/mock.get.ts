// Dev-only stand-in for a real provider, so the request flow can be exercised
// without registering three OAuth apps — the same courtesy `NUXT_LULU_MOCK` and
// the console email transport already extend to the rest of the pay-it-forward
// loop.
//
// `import.meta.dev` is replaced at build time, so in a production bundle the
// guard below is a constant `true` and this route can only ever 404. The
// runtime check on the same line is belt and braces; neither is load-bearing on
// its own.
//
//   /verify/mock?name=Jane%20Doe&redirect=/cart
//
// The account key is derived from the name, so challenging twice under the same
// name is the same person — which is what makes the one-open-request-per-account
// rule testable.

export default defineEventHandler(async (event) => {
  if (!import.meta.dev || process.env.NODE_ENV === 'production') {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const query = getQuery(event)
  const name = String(query.name || '').trim().slice(0, 80) || 'Test Reader'
  const subject = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  console.warn(`[verify] mock challenge passed as "${name}" — dev only, never available in production.`)

  return completeChallenge(event, {
    provider: 'mock',
    subject,
    name
  }, `${subject}@example.test`)
})
