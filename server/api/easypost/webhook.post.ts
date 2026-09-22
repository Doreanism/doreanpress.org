export default defineEventHandler(async (event) => {
  const secret = useRuntimeConfig().easypost.webhookSecret
  if (!secret) throw createError({ statusCode: 503, statusMessage: 'Tracking webhooks are not configured.' })
  const raw = await readRawBody(event) || ''
  if (!verifyTrackingSignature(raw, getHeader(event, 'x-hmac-signature') || '', secret)) throw createError({ statusCode: 400, statusMessage: 'Invalid signature.' })
  const payload = JSON.parse(raw)
  if (payload.description === 'tracker.updated') await applyTrackingEvent(payload.id, payload.result)
  await flushMinistryEmails()
  return { received: true }
})
