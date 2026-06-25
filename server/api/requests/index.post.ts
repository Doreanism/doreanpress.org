import { findBook } from '#shared/catalog'

interface Body {
  bookSlug?: string
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
  const body = await readBody<Body>(event)

  const book = findBook(str(body?.bookSlug, 120))
  if (!book) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown book.' })
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
    bookSlug: book.slug,
    message,
    name,
    email,
    phone,
    address
  })

  return { id: record.id, status: record.status }
})
