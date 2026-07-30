// Withdraw a request. Only the account that posted it may pull it — see
// `requireRequestOwner`.
//
// A request that's already been sponsored (status !== 'open') can't be pulled:
// a copy is in flight, so there's nothing for the reader to cancel.
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
      statusMessage: 'This request has already been sponsored and can no longer be withdrawn.'
    })
  }

  await deleteRequest(id)
  return { ok: true }
})
