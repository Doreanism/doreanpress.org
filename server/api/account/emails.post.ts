import { loginOrigin } from '#shared/login'

export default defineEventHandler(async (event) => {
  const account = await requireEmailAccount(event, 'adding an email address')
  const body = await readBody<{ email?: string }>(event).catch(() => null)
  const email = normalizeEmail(body?.email || '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
    throw createError({ statusCode: 422, statusMessage: 'Please enter an email address.' })
  }
  const token = await issueLoginLink(email, '/emails', account.accountId)
  if (token) {
    const origin = loginOrigin(getRequestURL(event).href, useRuntimeConfig(event).public.siteUrl, Boolean(import.meta.dev))
    const url = `${origin}/account/confirm#token=${token}`
    await sendEmail({
      to: email, subject: 'Verify your additional Dorean Press email',
      text: `Open this link in the browser where you requested it to add this email to your Dorean Press account:\n\n${url}\n\nIt works once, for ten minutes. If you did not request this, ignore this email.`,
      html: `<p><a href="${url}">Verify this email address</a></p><p>Open this link in the browser where you requested it. It works once, for ten minutes. If you did not request this, ignore this email.</p>`
    }, true)
  }
  return { sent: true }
})
