export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/')) {
    try {
      await requireAdministrator(event)
    } catch (err) {
      if (!path.startsWith('/api/') && (err as { statusCode?: number })?.statusCode === 401) {
        const url = getRequestURL(event)
        return sendRedirect(event, `/account?redirect=${encodeURIComponent(url.pathname + url.search)}`)
      }
      throw err
    }
  }
})
