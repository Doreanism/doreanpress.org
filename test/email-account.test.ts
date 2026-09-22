import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())
it('requires email login even when a provider-only session exists', async () => {
  vi.stubGlobal('db', () => async () => [{ id: 'legacy', email: null }])
  vi.stubGlobal('getUserSession', async () => ({ signedIn: { accountId: 'legacy', label: '@reader' } }))
  vi.stubGlobal('createError', (e: object) => Object.assign(new Error('Sign in'), e))
  const { requireEmailAccount } = await import('../server/utils/signedIn')
  await expect(requireEmailAccount({} as never, 'requesting books')).rejects.toMatchObject({ statusCode: 401 })
})
it('rejects anonymous requests before reading their body or social profiles', async () => {
  vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
  const identities = vi.fn()
  vi.stubGlobal('requireIdentities', identities)
  vi.stubGlobal('requireEmailAccount', () => {
    throw Object.assign(new Error('Sign in'), { statusCode: 401 })
  })
  const handler = (await import('../server/api/requests/index.post')).default
  await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 401 })
  expect(identities).not.toHaveBeenCalled()
})
it('stores the verified email even if the request body supplies another address', async () => {
  vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
  vi.stubGlobal('requireEmailAccount', async () => ({ accountId: 'reader', email: 'verified@example.test' }))
  vi.stubGlobal('requireIdentities', async () => [])
  vi.stubGlobal('listOpenRequestsForAccounts', async () => [])
  vi.stubGlobal('readBody', async () => ({ items: [{ slug: 'the-doctrine-of-simony', quantity: 1 }], message: 'Please send a book.', name: 'Reader', email: 'stranger@example.test', phone: '123', address: { line1: '1 Main St', city: 'Town', postalCode: '12345', country: 'US' } }))
  vi.stubGlobal('destinationKey', () => 'destination')
  const create = vi.fn(async (data: object) => ({ ...data, id: 'request', status: 'open' }))
  vi.stubGlobal('createRequest', create)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { siteUrl: 'https://example.test' } }))
  vi.stubGlobal('getRequestURL', () => new URL('https://example.test/api/requests'))
  vi.stubGlobal('sendEmail', vi.fn())
  vi.stubGlobal('requestConfirmationEmail', vi.fn())
  vi.stubGlobal('pressEmailAddress', () => '')
  const handler = (await import('../server/api/requests/index.post')).default
  await handler({} as never)
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ email: 'verified@example.test' }))
})
