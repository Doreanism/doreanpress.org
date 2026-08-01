// Public list of open requests — only board-safe fields.
//
// One card per order, and a reader has one open order per address (see
// `POST /api/requests`), so this needs no grouping: the books a reader is
// waiting for are already in one order by the time they reach the board.
export default defineEventHandler(async () => {
  const open = await listOpenRequests()
  return open.map(toPublic)
})
