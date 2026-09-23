import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const expiresAt = '2026-09-23T20:30:00.000Z'
const sql = Object.assign(vi.fn(), { transaction: vi.fn() })
const setCookie = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('useRuntimeConfig', () => ({ zeffy: {
    campaignUrl: 'https://www.zeffy.com/embed/donation-form/test', campaignId: 'test',
    webhookSecret: 'test', recommendationQuestion: 'Code'
  }, giftEstimate: { firstCopyCents: 1200, additionalCopyCents: 700 } }))
  vi.stubGlobal('getRouterParam', () => 'request-1')
  vi.stubGlobal('ensureMinistrySchema', async () => {})
  vi.stubGlobal('getRequest', async () => ({ status: 'open', address: { country: 'US' }, items: [{ slug: 'the-doctrine-of-simony', quantity: 1 }] }))
  vi.stubGlobal('db', () => sql)
  vi.stubGlobal('getCookie', () => undefined)
  vi.stubGlobal('setCookie', setCookie)
  vi.stubGlobal('readBody', async () => ({}))
  vi.stubGlobal('createError', (value: object) => Object.assign(new Error(), value))
})
afterEach(() => vi.unstubAllGlobals())

async function start() {
  const { default: handler } = await import('../server/api/requests/[id]/sponsor.post')
  return handler({} as never)
}

it('remembers a new reservation so a closed tab can be recovered', async () => {
  sql.transaction.mockResolvedValue([[], [{ id: 'new-code', expires_at: expiresAt, items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }] }]])
  const result = await start()
  expect(result).toMatchObject({ recommendation: 'new-code', expiresAt, resumed: false })
  expect(setCookie).toHaveBeenCalledWith({}, 'gift-request-1', expect.any(String), expect.objectContaining({ httpOnly: true, maxAge: 86400 }))
})

it('reopens the original reservation without extending its deadline or creating another', async () => {
  vi.stubGlobal('getCookie', () => 'original-code')
  sql.mockResolvedValue([{ id: 'original-code', expires_at: expiresAt, items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }] }])
  const result = await start()
  expect(result).toMatchObject({ recommendation: 'original-code', expiresAt, resumed: true, estimatedCents: 1200 })
  expect(result.items).toEqual([{ slug: 'the-doctrine-of-simony', quantity: 1 }])
  expect(sql.transaction).not.toHaveBeenCalled()
  expect(setCookie).not.toHaveBeenCalled()
})

it('creates a fresh reservation when the previous one is no longer eligible', async () => {
  vi.stubGlobal('getCookie', () => 'expired-code')
  sql.mockResolvedValue([])
  sql.transaction.mockResolvedValue([[], [{ id: 'fresh-code', expires_at: expiresAt, items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }] }]])
  expect(await start()).toMatchObject({ recommendation: 'fresh-code', resumed: false })
})

it('reports an unavailable or changed request', async () => {
  sql.transaction.mockResolvedValue([[], []])
  await expect(start()).rejects.toMatchObject({ statusCode: 409 })
  expect(setCookie).not.toHaveBeenCalled()
})

async function renew() {
  const { default: handler } = await import('../server/api/requests/[id]/keep-alive.post')
  return handler({} as never)
}

it('renews a live reservation for the browser holding its code', async () => {
  vi.stubGlobal('getCookie', () => 'original-code')
  vi.stubGlobal('readBody', async () => ({ recommendation: 'original-code' }))
  sql.transaction.mockResolvedValue([[], [{ expires_at: expiresAt, items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }] }]])
  expect(await renew()).toEqual({ expiresAt, targetCents: null, fundedCents: 0 })
})

it.each([undefined, 'another-code'])('rejects a heartbeat without the matching browser cookie (%s)', async (cookie) => {
  vi.stubGlobal('getCookie', () => cookie)
  vi.stubGlobal('readBody', async () => ({ recommendation: 'original-code' }))
  await expect(renew()).rejects.toMatchObject({ statusCode: 403 })
  expect(sql.transaction).not.toHaveBeenCalled()
})

it('reports an ended reservation instead of issuing a fresh code during renewal', async () => {
  vi.stubGlobal('getCookie', () => 'original-code')
  vi.stubGlobal('readBody', async () => ({ recommendation: 'original-code' }))
  sql.transaction.mockResolvedValue([[], []])
  await expect(renew()).rejects.toMatchObject({ statusCode: 409 })
  expect(setCookie).not.toHaveBeenCalled()
})

async function release() {
  const { default: handler } = await import('../server/api/requests/[id]/release.post')
  return handler({} as never)
}

it('releases the browser’s reservation when its page closes', async () => {
  vi.stubGlobal('getCookie', () => 'original-code')
  vi.stubGlobal('readBody', async () => ({ recommendation: 'original-code' }))
  sql.transaction.mockResolvedValue([[], []])
  expect(await release()).toEqual({ released: true })
  expect(sql.transaction).toHaveBeenCalledTimes(1)
})

it.each([undefined, 'newer-code'])('does not let a closing page release another reservation (%s)', async (cookie) => {
  vi.stubGlobal('getCookie', () => cookie)
  vi.stubGlobal('readBody', async () => ({ recommendation: 'original-code' }))
  await expect(release()).rejects.toMatchObject({ statusCode: 403 })
  expect(sql.transaction).not.toHaveBeenCalled()
})

it('shows the remaining whole-request balance when checkout is reopened', async () => {
  vi.stubGlobal('getRequest', async () => ({ status: 'open', address: { country: 'US' },
    fundingTargetCents: 1200, fundedCents: 500, items: [{ slug: 'the-doctrine-of-simony', quantity: 1 }] }))
  vi.stubGlobal('getCookie', () => 'original-code')
  sql.mockResolvedValue([{ id: 'original-code', expires_at: expiresAt, target_cents: 1900, items: [{ slug: 'the-doctrine-of-simony', quantity: 1 }] }])
  expect(await start()).toMatchObject({ targetCents: 1200, fundedCents: 500, estimatedCents: 700 })
})
