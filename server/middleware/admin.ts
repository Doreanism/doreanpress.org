export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/')) {
    await requireAdministrator(event)
  }
})
