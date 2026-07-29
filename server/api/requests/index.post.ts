import { findBook, itemTitles, type RequestItem } from '#shared/catalog'
import { accountKey } from '#shared/identity'

interface Body {
  items?: { slug?: string, quantity?: number }[]
  message?: string
  name?: string
  email?: string
  phone?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }
}

const str = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max)

export default defineEventHandler(async (event) => {
  // A free book goes to a person, so a request has to come from one. Signing in
  // with a public account is what puts a name and a face on the board for the
  // sponsor to look at, and what makes the limit below mean anything.
  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Please sign in with a public account before asking for a book.'
    })
  }

  // One open request per account. Without this the sign-in would only slow a
  // scammer down once; with it, every extra posting costs another real account.
  const waiting = await findOpenRequestByAccount(accountKey(user.identity))
  if (waiting) {
    throw createError({
      statusCode: 409,
      statusMessage: 'You already have a request on the Give a Book board. Please wait for it to be sponsored, or remove it before posting another.'
    })
  }

  const body = await readBody<Body>(event)

  // Re-derive every line from the catalog and merge duplicate slugs, so the
  // order stored on the board is one the press can actually print.
  const items: RequestItem[] = []
  for (const raw of Array.isArray(body?.items) ? body.items : []) {
    const book = findBook(str(raw?.slug, 120))
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(raw?.quantity) || 1)))
    if (!book) continue
    const existing = items.find(i => i.slug === book.slug)
    if (existing) existing.quantity = Math.min(99, existing.quantity + quantity)
    else items.push({ slug: book.slug, quantity })
  }

  if (items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Your request has no books in it.' })
  }

  const message = str(body?.message, 1000)
  const name = str(body?.name, 120)
  const email = str(body?.email, 200)
  const phone = str(body?.phone, 40)
  const a = body?.address || {}
  const address = {
    line1: str(a.line1, 200),
    line2: str(a.line2, 200) || undefined,
    city: str(a.city, 120),
    state: str(a.state, 120) || undefined,
    postalCode: str(a.postalCode, 40),
    country: str(a.country, 2).toUpperCase()
  }

  const missing: string[] = []
  if (message.length < 5) missing.push('message')
  if (!name) missing.push('name')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push('email')
  if (!phone) missing.push('phone')
  if (!address.line1) missing.push('address.line1')
  if (!address.city) missing.push('address.city')
  if (!address.postalCode) missing.push('address.postalCode')
  if (address.country.length !== 2) missing.push('address.country')

  if (missing.length) {
    throw createError({
      statusCode: 422,
      statusMessage: `Please complete: ${missing.join(', ')}`
    })
  }

  const record = await createRequest({
    items,
    message,
    // Snapshotted, not looked up later: the board should show the account as it
    // was when the reader stood behind the request, even if they rename it.
    requester: user.identity,
    name,
    email,
    phone,
    address
  })

  // Confirm to the requester, and (optionally) notify the press. The withdraw
  // link lets them pull their own posting (the request id is the capability).
  // Prefer the actual request origin so the link works on whatever host/port
  // the app is really served from (dev may shift off 3000); fall back to config.
  const configured = useRuntimeConfig(event).public.siteUrl.replace(/\/$/, '')
  const origin = getRequestURL(event).origin || configured
  const withdrawUrl = `${origin}/give/withdraw?id=${record.id}`
  const titles = itemTitles(items)
  await sendEmail(requestConfirmationEmail({ to: email, name, titles, withdrawUrl }))
  const press = pressEmailAddress()
  if (press) {
    await sendEmail(pressNewRequestEmail({ to: press, name, titles, message, requester: user.identity }))
  }

  return { id: record.id, status: record.status }
})
