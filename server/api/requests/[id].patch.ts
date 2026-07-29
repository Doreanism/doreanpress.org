// Edit an open request. Only the account that posted it may change it — see
// `requireRequestOwner`.
//
// Partial update: only the fields present in the body are changed. Lifecycle
// fields (status, sponsor, fulfilment) are never editable here, and neither is
// `requester` — the account that stands behind a posting is fixed at the moment
// it was made. A request that's already been sponsored is frozen: a copy is in
// flight.
interface Body {
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
  const id = getRouterParam(event, 'id') || ''
  const request = await getRequest(id)

  if (!request) {
    throw createError({ statusCode: 404, statusMessage: 'This request no longer exists.' })
  }

  await requireRequestOwner(event, request)

  if (request.status !== 'open') {
    throw createError({
      statusCode: 409,
      statusMessage: 'This request has already been sponsored and can no longer be edited.'
    })
  }

  const body = await readBody<Body>(event)
  const patch: Partial<BookRequest> = {}
  const invalid: string[] = []

  if (body?.message !== undefined) {
    const message = str(body.message, 1000)
    if (message.length < 5) invalid.push('message')
    else patch.message = message
  }
  if (body?.name !== undefined) {
    const name = str(body.name, 120)
    if (!name) invalid.push('name')
    else patch.name = name
  }
  if (body?.email !== undefined) {
    const email = str(body.email, 200)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) invalid.push('email')
    else patch.email = email
  }
  if (body?.phone !== undefined) {
    const phone = str(body.phone, 40)
    if (!phone) invalid.push('phone')
    else patch.phone = phone
  }
  if (body?.address !== undefined) {
    const a = body.address || {}
    const address = {
      line1: str(a.line1, 200),
      line2: str(a.line2, 200) || undefined,
      city: str(a.city, 120),
      state: str(a.state, 120) || undefined,
      postalCode: str(a.postalCode, 40),
      country: str(a.country, 2).toUpperCase()
    }
    if (!address.line1) invalid.push('address.line1')
    if (!address.city) invalid.push('address.city')
    if (!address.postalCode) invalid.push('address.postalCode')
    if (address.country.length !== 2) invalid.push('address.country')
    if (!invalid.some(f => f.startsWith('address'))) patch.address = address
  }

  if (invalid.length) {
    throw createError({
      statusCode: 422,
      statusMessage: `Please correct: ${invalid.join(', ')}`
    })
  }

  if (!Object.keys(patch).length) {
    throw createError({ statusCode: 400, statusMessage: 'No changes supplied.' })
  }

  const updated = await updateRequest(id, patch)
  // The proof was raised to make this edit, and it has. Spend it.
  await spendProof(event)
  return toPublic(updated!)
})
