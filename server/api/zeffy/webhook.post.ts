export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig().zeffy
  if (!config.webhookSecret || !config.campaignId) throw createError({ statusCode: 503, statusMessage: 'Zeffy is not configured.' })
  const raw = await readRawBody(event) || ''
  if (!verifyZeffySignature(raw, getHeader(event, 'zeffy-signature') || '', config.webhookSecret)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid webhook signature.' })
  }
  let payload
  try {
    payload = JSON.parse(raw)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON.' })
  }
  await recordZeffyGift(payload)
  await flushMinistryEmails()
  return { received: true }
})
