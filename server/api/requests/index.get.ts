// Public list of open requests — only board-safe fields, and grouped so one
// reader's orders to one address arrive as a single entry.
export default defineEventHandler(async () => {
  return groupRequests(await listOpenRequests())
})
