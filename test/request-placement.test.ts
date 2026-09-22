import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { destinationKey, foldOrders } from '../server/utils/requests'

const body = {
  items: [{ slug: 'the-doctrine-of-simony', quantity: 1 }], name: 'Reader',
  address: { line1: '123 Main St', city: 'Town', postalCode: '12345', country: 'US' }
}
const createRequest = vi.fn(async input => ({ ...input, id: 'request-1', status: 'open' }))
const updateRequest = vi.fn(async (id, patch) => ({ ...body, ...patch, id, status: 'open' }))
const waiting = vi.fn(async () => [] as Record<string, unknown>[])

beforeEach(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('readBody', async () => body)
  vi.stubGlobal('requireEmailAccount', async () => ({ accountId: 'reader-1', email: 'reader@example.com' }))
  vi.stubGlobal('requireIdentities', async () => [{ provider: 'youface', subject: 'reader-1' }])
  vi.stubGlobal('listOpenRequestsForAccounts', waiting)
  vi.stubGlobal('destinationKey', destinationKey)
  vi.stubGlobal('foldOrders', foldOrders)
  vi.stubGlobal('createRequest', createRequest)
  vi.stubGlobal('updateRequest', updateRequest)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { siteUrl: 'http://localhost:3000' } }))
  vi.stubGlobal('getRequestURL', () => new URL('http://localhost:3000/api/requests'))
  vi.stubGlobal('requestConfirmationEmail', (input: unknown) => input)
  vi.stubGlobal('sendEmail', async () => {})
  vi.stubGlobal('pressEmailAddress', () => '')
  vi.stubGlobal('createError', (input: object) => Object.assign(new Error(), input))
  waiting.mockResolvedValue([])
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('placing a request before writing a sponsor message', () => {
  it('accepts delivery details without a phone number or message', async () => {
    const { default: handler } = await import('../server/api/requests/index.post')
    const result = await handler({} as never)
    expect(createRequest).toHaveBeenCalledWith(expect.objectContaining({ message: '', phone: '', accountId: 'reader-1' }))
    expect(result).toMatchObject({ id: 'request-1', message: '' })
  })

  it('preserves the existing sponsor message when adding another book', async () => {
    waiting.mockResolvedValue([{ ...body, id: 'existing', message: 'For our study group.' }])
    const { default: handler } = await import('../server/api/requests/index.post')
    const result = await handler({} as never)
    expect(createRequest).not.toHaveBeenCalled()
    expect(updateRequest).toHaveBeenCalledWith('existing', {
      items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }], message: 'For our study group.'
    })
    expect(result.message).toBe('For our study group.')
  })

  it('still requires a complete delivery address', async () => {
    vi.stubGlobal('readBody', async () => ({ ...body, address: {} }))
    const { default: handler } = await import('../server/api/requests/index.post')
    await expect(handler({} as never)).rejects.toMatchObject({ statusCode: 422 })
    expect(createRequest).not.toHaveBeenCalled()
  })
})
