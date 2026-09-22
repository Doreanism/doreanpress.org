import { timingSafeEqual } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const secret = useRuntimeConfig().maintenanceSecret
  const header = getHeader(event, 'authorization') || ''
  const expected = `Bearer ${secret}`
  if (!secret || header.length !== expected.length || !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
    throw createError({ statusCode: 401, statusMessage: 'Maintenance authentication required.' })
  }
  await ensureMinistrySchema()
  await reconcileTracking()
  await flushMinistryEmails()
  return { ok: true }
})
