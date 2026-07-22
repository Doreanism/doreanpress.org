// Fetch a single open request by id — board-safe fields only.
// Used by the withdraw page to show the requester what they're about to remove.
// The id is an unguessable UUID, shared only with the requester (and the public
// fields are already visible on the board), so no further auth is needed.
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') || ''
  const request = await getRequest(id)

  if (!request || request.status !== 'open') {
    throw createError({ statusCode: 404, statusMessage: 'This request is no longer available.' })
  }

  return toPublic(request)
})
