import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllGlobals())
it('loads the queue in one query without exposing private details in its summary', async () => {
  const sql = vi.fn(async () => Array.from({ length: 20 }, (_, i) => ({
    id: `order-${i}`, items: [{ slug: 'the-doctrine-of-simony', quantity: 1 }],
    status: 'funded_awaiting_order', address: { country: 'US', line1: 'Private Street' },
    name: 'Private Name', email: 'private@example.test', created_at: '2026-09-23', fulfillment: {}
  })))
  vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
  vi.stubGlobal('requireAdministrator', async () => ({ accountId: 'admin' }))
  vi.stubGlobal('getQuery', () => ({}))
  vi.stubGlobal('db', () => sql)
  vi.stubGlobal('fulfillmentSummary', (await import('../server/utils/fulfillment')).fulfillmentSummary)
  const { default: handler } = await import('../server/api/admin/fulfillment/index.get')
  const result = await handler({} as never)
  expect(result).toHaveLength(20)
  expect(sql).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(result)).not.toContain('Private')
  expect(JSON.stringify(result)).not.toContain('private@example.test')
})
