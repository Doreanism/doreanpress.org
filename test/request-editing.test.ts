import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const items = [{ slug: 'the-doctrine-of-simony', quantity: 2 }]
const request = { id: 'request', status: 'open', items, message: 'Original message' }
const update = vi.fn()
const owner = vi.fn()

beforeEach(() => {
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('getRouterParam', () => 'request')
  vi.stubGlobal('getRequest', async () => request)
  vi.stubGlobal('requireRequestOwner', owner.mockResolvedValue(undefined))
  vi.stubGlobal('readBody', async () => ({ items: [{ ...items[0], quantity: 3 }], originalItems: items }))
  vi.stubGlobal('updateRequest', update.mockImplementation(async (id, patch) => ({ ...request, ...patch, id })))
  vi.stubGlobal('toPublic', (r: unknown) => r)
  vi.stubGlobal('createError', (input: object) => Object.assign(new Error(), input))
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
async function edit() {
  return (await import('../server/api/requests/[id].patch')).default({} as never)
}

describe('editing requested quantities', () => {
  it.each([1, 3, 99])('saves %i copies after checking ownership, preserving other fields', async (quantity) => {
    const next = [{ ...items[0], quantity }]
    vi.stubGlobal('readBody', async () => ({ items: next, originalItems: items }))
    expect(await edit()).toMatchObject({ items: next, message: 'Original message' })
    expect(owner).toHaveBeenCalledWith({}, request)
    expect(update).toHaveBeenCalledWith('request', { items: next }, request)
  })
  it.each([[], null, [{ slug: 'unknown', quantity: 1 }],
    [{ ...items[0], quantity: 0 }], [{ ...items[0], quantity: -1 }],
    [{ ...items[0], quantity: 1.5 }], [{ ...items[0], quantity: 100 }],
    [{ ...items[0], quantity: '2' }], [items[0], items[0]]])('rejects invalid items: %j', async (next) => {
    vi.stubGlobal('readBody', async () => ({ items: next, originalItems: items }))
    await expect(edit()).rejects.toMatchObject({ statusCode: 422 })
    expect(update).not.toHaveBeenCalled()
  })
  it('rejects a stale draft', async () => {
    vi.stubGlobal('readBody', async () => ({ items, originalItems: [{ ...items[0], quantity: 1 }] }))
    await expect(edit()).rejects.toMatchObject({ statusCode: 409 })
    expect(update).not.toHaveBeenCalled()
  })
  it('rejects editing someone else’s request', async () => {
    owner.mockRejectedValue({ statusCode: 403 })
    await expect(edit()).rejects.toMatchObject({ statusCode: 403 })
    expect(update).not.toHaveBeenCalled()
  })
  it.each(['fulfilled', 'funded_awaiting_order', 'ordered', 'done', 'needs_attention', 'cancelled'])('rejects item edits for %s requests', async (status) => {
    vi.stubGlobal('getRequest', async () => ({ ...request, status }))
    await expect(edit()).rejects.toMatchObject({ statusCode: 409 })
    expect(update).not.toHaveBeenCalled()
  })
  it('reports a conflict when the request changes during saving', async () => {
    update.mockResolvedValue(null)
    await expect(edit()).rejects.toMatchObject({ statusCode: 409 })
  })
})
