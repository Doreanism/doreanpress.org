import { loginOrigin } from '#shared/login'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, redirect?: string }>(event).catch(() => null)
  const email = normalizeEmail(body?.email || '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
    throw createError({ statusCode: 400, statusMessage: 'Please enter an email address.' })
  }
  const origin = loginOrigin(getRequestURL(event).href, useRuntimeConfig(event).public.siteUrl, Boolean(import.meta.dev))
  const token = await issueLoginLink(email, body?.redirect)
  if (token) {
    // Fragments never reach server access logs or HTTP referrers. Opening the
    // page signs in through a client-side POST, never through an HTTP GET.
    const url = `${origin}/account/confirm#token=${token}`
    await sendEmail(signInLinkEmail({ to: email, url, minutes: 10 }), true)
  }
  // The same answer for new accounts, returning readers and throttled sends.
  return { sent: true }
})
