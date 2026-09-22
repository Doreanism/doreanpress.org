export default defineNuxtRouteMiddleware(async () => {
  try {
    await useRequestFetch()('/api/admin/me')
  } catch {
    return abortNavigation(createError({ statusCode: 403, statusMessage: 'Sign in with an administrator account to continue.' }))
  }
})
