// Public list of open requests — only board-safe fields.
export default defineEventHandler(async () => {
  const open = await listOpenRequests()
  return open.map(toPublic)
})
