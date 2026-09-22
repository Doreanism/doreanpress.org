// Covers both outbound OAuth and callbacks, including development providers.
export default defineEventHandler(async (event) => {
  if (getRequestURL(event).pathname.startsWith('/verify/')) {
    const account = await readSignedIn(event)
    if (!account?.email) return sendRedirect(event, '/account?redirect=%2Fprofiles')
  }
})
