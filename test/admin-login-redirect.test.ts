import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())
async function check(path: string, statusCode: number) {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRequestURL', () => new URL(path, 'https://example.test'))
  vi.stubGlobal('requireAdministrator', async () => {
    throw { statusCode }
  })
  vi.stubGlobal('sendRedirect', (_: unknown, location: string) => location)
  const { default: handler } = await import('../server/middleware/admin')
  return handler({} as never)
}
it('prompts a signed-out admin-page visitor to sign in with a return path', async () => {
  expect(await check('/admin/fulfillment?page=2', 401)).toBe('/account?redirect=%2Fadmin%2Ffulfillment%3Fpage%3D2')
})
it('keeps API authentication failures available to the inline sign-in prompt', async () => {
  await expect(check('/api/admin/fulfillment', 401)).rejects.toMatchObject({ statusCode: 401 })
})
it('does not treat missing admin permission as an expired login', async () => {
  await expect(check('/admin/fulfillment', 403)).rejects.toMatchObject({ statusCode: 403 })
})
