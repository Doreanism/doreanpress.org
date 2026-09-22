export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  setResponseHeader(event, 'Cache-Control', 'no-store')
  try {
    // Return only the count, never inbox contents, and never proxy arbitrary URLs.
    const inbox = await $fetch<{ unread: number }>('http://localhost:8025/api/v1/messages', {
      query: { limit: 1 },
      timeout: 2000
    })
    return { unread: Number.isSafeInteger(inbox.unread) && inbox.unread >= 0 ? inbox.unread : null }
  } catch {
    return { unread: null }
  }
})
