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
  // A free book goes to a person, so a request has to come from one. The
  // challenge is what puts a name and a face on the board for the sponsor to
  // look at, and what makes the limit below mean anything.
  const proof = await requireProof(event, 'asking for a book')

  // What this account already has waiting. The limit is one open *destination*,
  // not one posting — see below, once the address has been read.
  const waiting = await listOpenRequestsByAccount(accountKey(proof.identity))

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

  // How many copies a request asks for is left to the reader: a sponsor decides
  // what they are willing to cover, and can fund part of an order, so a large
  // request costs nobody anything they did not choose to give.

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

  // One open order per doorstep, rather than one open request per account.
  //
  // A reader already on the board who asks for another book is not papering
  // anything — they remembered a title — and they are still one person waiting
  // for one parcel. So the books go into the order that is already there: one
  // card, one list, one sponsor button, no second posting to stack beneath the
  // first. A different address is the shape the challenge exists to make
  // expensive, so that is where this bites instead.
  const destination = destinationKey({ name, address })
  const already = waiting.find(r => destinationKey(r) === destination)

  if (waiting.length > 0 && !already) {
    throw createError({
      statusCode: 409,
      statusMessage: 'You already have an order waiting on the Give a Book board, going to a different address. Anything you ask for at that same address is added to it — to ship somewhere else, remove that request first.'
    })
  }

  // The rule above is worth exactly what the account behind it cost.
  //
  // For a signed-in account that is a lot: papering the board means buying more
  // social accounts. For a named one it is nothing — the next request can claim
  // any handle at all, and `waiting` comes back empty every time. So for those,
  // hold the line at the doorstep instead, which is the thing a person asking
  // for parcels cannot multiply: one open order per address, no matter whose
  // name is on it. A reader who really does share an address with another
  // requester can still sign in, which is the honest way through.
  if (proof.identity.confirmation !== 'control' && !already) {
    const here = await listOpenRequestsAtDestination(destination)
    if (here.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'There is already an open request going to this address. If it is yours, add books to it instead of posting again — or sign in with a social account to post separately.'
      })
    }
  }

  const record = already
    ? await updateRequest(already.id, foldOrders(already, { items, message }))
    : await createRequest({
        items,
        message,
        // Snapshotted, not looked up later: the board should show the account as
        // it was when the reader stood behind the request, even if they rename it.
        requester: proof.identity,
        name,
        email,
        phone,
        address
      })

  // Only reachable if the order was sponsored or withdrawn between reading it
  // above and writing to it. Nothing is lost — asking again posts it afresh.
  if (!record) {
    throw createError({
      statusCode: 409,
      statusMessage: 'That request just left the board. Please send yours again.'
    })
  }

  // The proof is left in hand. It is still true that this account is here, and
  // the reader is very often not finished — correcting the message or taking the
  // posting down are the next things they do.

  // Confirm to the requester, and (optionally) notify the press. The withdraw
  // link tells them where to go; proving the account again is what authorises it.
  // Prefer the actual request origin so the link works on whatever host/port
  // the app is really served from (dev may shift off 3000); fall back to config.
  const configured = useRuntimeConfig(event).public.siteUrl.replace(/\/$/, '')
  const origin = getRequestURL(event).origin || configured
  const withdrawUrl = `${origin}/give/withdraw?id=${record.id}`
  // The whole order, not just what this form added: a reader who came back for
  // one more book should be told what is now waiting for them, in one list.
  const titles = itemTitles(record.items)
  await sendEmail(requestConfirmationEmail({ to: email, name, titles, withdrawUrl }))
  const press = pressEmailAddress()
  if (press) {
    await sendEmail(pressNewRequestEmail({ to: press, name, titles, message, requester: proof.identity }))
  }

  return { id: record.id, status: record.status }
})
