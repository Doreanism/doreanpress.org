import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

// `verifyLuluWebhookSignature` reads config through Nitro's auto-imported
// `useRuntimeConfig`, which a plain vitest process doesn't provide.
function withSecret(clientSecret: string) {
  vi.stubGlobal('useRuntimeConfig', () => ({
    lulu: {
      clientKey: clientSecret ? 'key' : '',
      clientSecret,
      baseUrl: 'https://api.lulu.com',
      contactEmail: 'orders@doreanpress.org',
      mock: 'false'
    }
  }))
}

const { verifyLuluWebhookSignature } = await import('../server/utils/lulu')

const SECRET = 'test-client-secret'
const BODY = JSON.stringify({ topic: 'PRINT_JOB_STATUS_CHANGED', data: { id: 1, status: { name: 'SHIPPED' } } })
const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body).digest('hex')

afterEach(() => vi.unstubAllGlobals())

// This endpoint marks a request fulfilled and emails the reader a tracking
// link, so anything that gets past the signature check acts on the reader's
// behalf. These cases are all about what must NOT get through.
describe('verifyLuluWebhookSignature', () => {
  it('accepts a body signed with the client secret', () => {
    withSecret(SECRET)
    expect(verifyLuluWebhookSignature(BODY, sign(BODY))).toBe(true)
  })

  it('accepts an upper-case signature, since hex casing is not meaningful', () => {
    withSecret(SECRET)
    expect(verifyLuluWebhookSignature(BODY, sign(BODY).toUpperCase())).toBe(true)
  })

  it('rejects a body altered after signing', () => {
    withSecret(SECRET)
    const tampered = BODY.replace('SHIPPED', 'CANCELED')
    expect(verifyLuluWebhookSignature(tampered, sign(BODY))).toBe(false)
  })

  it('rejects a signature made with a different secret', () => {
    withSecret(SECRET)
    expect(verifyLuluWebhookSignature(BODY, sign(BODY, 'not-the-secret'))).toBe(false)
  })

  it('rejects a delivery carrying no signature at all', () => {
    withSecret(SECRET)
    expect(verifyLuluWebhookSignature(BODY, undefined)).toBe(false)
  })

  it('rejects a signature of the wrong length without throwing', () => {
    withSecret(SECRET)
    expect(verifyLuluWebhookSignature(BODY, 'abc123')).toBe(false)
  })

  // The point of the fail-closed change: outside dev, a deployment that never
  // got NUXT_LULU_CLIENT_SECRET has no way to tell Lulu from anyone else, so
  // it must refuse rather than wave the delivery through.
  it('refuses every delivery when no secret is configured', () => {
    withSecret('')
    expect(verifyLuluWebhookSignature(BODY, sign(BODY))).toBe(false)
    expect(verifyLuluWebhookSignature(BODY, undefined)).toBe(false)
  })
})
