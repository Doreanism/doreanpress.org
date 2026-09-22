import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { verifyZeffySignature } from '../server/utils/zeffy'
import { verifyTrackingSignature, deliveryStatus } from '../server/utils/tracking'
import { parseTrackingUrl, fulfillmentPatch, agentInstructions } from '../server/utils/fulfillment'
import { toGivenView, toMineView } from '../server/utils/orderViews'
import type { BookRequest } from '../server/utils/requests'

vi.stubGlobal('createError', (input: Record<string, unknown>) => Object.assign(new Error(String(input.statusMessage)), input))
const request: BookRequest = {
  id: 'order-1', status: 'funded_awaiting_order', items: [{ slug: 'the-doctrine-of-simony', quantity: 1 }],
  message: 'Please send a book', requesters: [], name: 'Private Name', email: 'private@example.com', phone: '123',
  address: { line1: '123 Private Road', city: 'Town', postalCode: '10000', country: 'US' }, createdAt: new Date().toISOString(),
  fulfillment: { maximumCents: 2500, marketplace: 'https://www.amazon.com', paymentMethod: 'Church Visa ending 1234' }
}

describe('signed payment events', () => {
  const now = 1800000000000
  const body = '{"amount":2500}'
  const signature = (text: string, timestamp: number) => `t=${timestamp},v1=${createHmac('sha256', 'secret').update(`${timestamp}.${text}`).digest('hex')}`
  it('authenticates original bytes within tolerance', () => expect(verifyZeffySignature(body, signature(body, now / 1000), 'secret', now)).toBe(true))
  it('rejects altered bytes', () => expect(verifyZeffySignature(body + ' ', signature(body, now / 1000), 'secret', now)).toBe(false))
  it('rejects stale and future signatures', () => {
    for (const seconds of [-301, 301]) expect(verifyZeffySignature(body, signature(body, now / 1000 + seconds), 'secret', now)).toBe(false)
  })
  it('rejects missing secrets and malformed signatures', () => {
    expect(verifyZeffySignature(body, signature(body, now / 1000), '', now)).toBe(false)
    expect(verifyZeffySignature(body, 't=1,v1=bad', 'secret', now)).toBe(false)
  })
})

describe('tracking privacy and fulfillment', () => {
  it.each(['http://www.ups.com/track', 'javascript:alert(1)', 'https://localhost/track', 'https://127.0.0.1/', 'https://[::1]/', 'https://www.ups.com.evil.test/', 'https://user:pass@www.ups.com/track', 'https://www.ups.com:444/track'])('rejects unsafe URL %s', (url) => {
    expect(() => parseTrackingUrl(url)).toThrow()
  })
  it('extracts a safe carrier URL without arbitrary parameters', () => {
    expect(parseTrackingUrl('https://www.ups.com/track?tracknum=1Z123456789&secret=private')).toMatchObject({ carrier: 'UPS', trackingNumber: '1Z123456789', recipientTrackingUrl: 'https://www.ups.com/track?tracknum=1Z123456789' })
  })
  it('never shares Amazon account links', () => expect(parseTrackingUrl('https://www.amazon.com/progress-tracker/package?orderId=123').recipientTrackingUrl).toBeUndefined())
  it('recording a purchase does not mark it done', () => {
    expect(fulfillmentPatch(request, { action: 'ordered', amazonOrderNumber: '123-1234567-1234567', actualCents: 2100 }, 'admin').status).toBe('ordered')
  })
  it('refuses excessive cost and repeated orders', () => {
    expect(() => fulfillmentPatch(request, { action: 'ordered', amazonOrderNumber: '123-1234567-1234567', actualCents: 3000 }, 'admin')).toThrow()
    expect(() => fulfillmentPatch({ ...request, status: 'ordered' }, { action: 'ordered' }, 'admin')).toThrow()
  })
  it('only valid tracking completes a recorded order; removal reopens it', () => {
    const ordered = { ...request, status: 'ordered' as const, fulfillment: { ...request.fulfillment, amazonOrderNumber: '123-1234567-1234567' } }
    const done = fulfillmentPatch(ordered, { action: 'tracking', trackingUrl: 'https://www.ups.com/track?tracknum=1Z123456789' }, 'admin')
    expect(done.status).toBe('done')
    expect(done.fulfillment.trackingSubmittedBy).toBe('admin')
    const reopened = fulfillmentPatch({ ...ordered, ...done }, { action: 'tracking', trackingUrl: '' }, 'admin')
    expect(reopened.status).toBe('ordered')
    expect(reopened.fulfillment.recipientTrackingUrl).toBeUndefined()
    expect(() => fulfillmentPatch(request, { action: 'tracking', trackingUrl: 'https://www.ups.com/track' }, 'admin')).toThrow()
  })
  it('copies preview unless expressly authorized, with no donor data', () => {
    expect(() => agentInstructions({ ...request, status: 'done' }, true)).toThrow()
    expect(() => agentInstructions({ ...request, fulfillment: { ...request.fulfillment, amazonOrderNumber: '123-1234567-1234567' } }, true)).toThrow()
    expect(agentInstructions(request, false)).toContain('PREVIEW ONLY')
    expect(agentInstructions(request, true)).toContain('authorized to place one KDP author-copy order')
    expect(agentInstructions({ ...request, sponsorEmail: 'donor@example.com' }, true)).not.toContain('donor@example.com')
  })
  it('only the requester sees the recipient tracking URL', () => {
    const r = { ...request, fulfillment: { recipientTrackingUrl: 'https://www.ups.com/track?tracknum=1Z123456789', trackingUrl: 'https://www.amazon.com/private' } }
    expect(toMineView(r).trackingUrl).toContain('ups.com')
    expect(JSON.stringify(toGivenView(r))).not.toContain('tracking')
    expect(JSON.stringify(toMineView(r))).not.toContain('amazon.com')
  })
  it('validates EasyPost signatures using their documented normalization', () => {
    const raw = '{"weight":12}'
    const header = 'hmac-sha256-hex=' + createHmac('sha256', 'secret').update('{"weight":12.0}').digest('hex')
    expect(verifyTrackingSignature(raw, header, 'secret')).toBe(true)
    expect(verifyTrackingSignature(raw, header, 'wrong')).toBe(false)
    expect(deliveryStatus('failure')).toBe('exception')
  })
})

describe('legacy request ownership', () => {
  it('does not treat a public request id as authorization', async () => {
    vi.stubGlobal('readSignedIn', async () => null)
    const { requireRequestOwner } = await import('../server/utils/requestAccess')
    await expect(requireRequestOwner({} as never, { ...request, hidden: true, requesters: [] })).rejects.toMatchObject({ statusCode: 403 })
  })
  it('lets the verified requester manage a legacy request', async () => {
    vi.stubGlobal('readSignedIn', async () => ({ email: request.email }))
    vi.stubGlobal('normalizeEmail', (s: string) => s.toLowerCase())
    const { requireRequestOwner } = await import('../server/utils/requestAccess')
    await expect(requireRequestOwner({} as never, request)).resolves.toBeUndefined()
  })
})
