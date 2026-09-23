export default defineNuxtRouteMiddleware(async (to) => {
  try {
    await useRequestFetch()('/api/admin/me')
  } catch (err) {
    if ((err as { statusCode?: number })?.statusCode === 401) {
      await useSignedIn().refresh()
      return navigateTo({ path: '/account', query: { redirect: to.fullPath } })
    }
    return abortNavigation(createError({ statusCode: 403, statusMessage: 'Sign in with an administrator account to continue.' }))
  }
})
