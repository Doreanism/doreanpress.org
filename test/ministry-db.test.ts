// Run explicitly against the local Neon proxy:
// node --env-file=.env node_modules/vitest/vitest.mjs run test/ministry-db.test.ts
// with MINISTRY_DB_TEST=1. Each run owns an isolated temporary schema.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { neon, neonConfig } from '@neondatabase/serverless'

const enabled = process.env.MINISTRY_DB_TEST === '1'
describe.skipIf(!enabled)('ministry database transactions', () => {
  const schema = `ministry_test_${Date.now()}`
  let sql: ReturnType<typeof neon>
  let raw: ReturnType<typeof neon>
  let requests: typeof import('../server/utils/requests')
  let ministry: typeof import('../server/utils/ministry')
  let zeffy: typeof import('../server/utils/zeffy')
  let accounts: typeof import('../server/utils/readerAccounts')
  let adminHandler: (event: unknown) => Promise<unknown>
  const config = { zeffy: { campaignId: 'campaign', recommendationQuestion: 'Code' }, public: { siteUrl: 'https://example.test' }, easypost: { apiKey: '' } }

  beforeAll(async () => {
    const endpoint = process.env.NEON_LOCAL_PROXY_ENDPOINT || ''
    if (!['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname)) throw Error('Integration tests require a local proxy')
    neonConfig.fetchEndpoint = endpoint
    raw = neon(process.env.DATABASE_URL!)
    await raw.query(`CREATE SCHEMA ${schema}`)
    const names = /\b(book_requests|reader_accounts|reader_emails|reader_identities|account_roles|ministry_audit|gift_reservations|ministry_gifts|ministry_outbox|ministry_tracking_events)\b/g
    sql = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => {
      const mapped = strings.map(s => s.replace(names, `${schema}.$1`))
      return raw(Object.assign(mapped, { raw: mapped }), ...values)
    }, { transaction: raw.transaction }) as typeof sql
    vi.stubGlobal('db', () => sql)
    vi.stubGlobal('createError', (input: Record<string, unknown>) => Object.assign(new Error(String(input.statusMessage)), input))
    vi.stubGlobal('normalizeEmail', (s: string) => s.toLowerCase())
    vi.stubGlobal('useRuntimeConfig', () => config)
    vi.stubGlobal('pressEmailAddress', () => 'admin@example.test')
    vi.stubGlobal('getUserSession', (e: { accountId?: string }) => ({ accountId: e.accountId }))
    vi.stubGlobal('readSignedIn', (e: { accountId?: string }) => e.accountId ? { accountId: e.accountId, at: new Date().toISOString() } : null)
    vi.stubGlobal('setResponseHeader', vi.fn())
    vi.stubGlobal('defineEventHandler', (f: unknown) => f)
    vi.stubGlobal('readBody', (e: { body: unknown }) => e.body)
    vi.stubGlobal('getRouterParam', (e: { id: string }) => e.id)
    requests = await import('../server/utils/requests')
    for (const [key, value] of Object.entries(requests)) vi.stubGlobal(key, value)
    ministry = await import('../server/utils/ministry')
    for (const [key, value] of Object.entries(ministry)) vi.stubGlobal(key, value)
    const fulfillment = await import('../server/utils/fulfillment')
    const tracking = await import('../server/utils/tracking')
    for (const [key, value] of Object.entries({ ...fulfillment, ...tracking })) vi.stubGlobal(key, value)
    vi.stubGlobal('sendEmail', vi.fn().mockResolvedValue(undefined))
    zeffy = await import('../server/utils/zeffy')
    accounts = await import('../server/utils/readerAccounts')
    vi.stubGlobal('publicRequests', (await import('../server/utils/publicRequests')).publicRequests)
    await ministry.ensureMinistrySchema()
    await accounts.listAttachedIdentities({} as never)
    adminHandler = (await import('../server/api/admin/fulfillment/[id].post')).default as never
  })
  afterAll(async () => {
    if (raw) await raw.query(`DROP SCHEMA ${schema} CASCADE`)
    vi.unstubAllGlobals()
  })
  async function request() {
    return requests.createRequest({ items: [{ slug: 'the-doctrine-of-simony', quantity: 1 }], message: 'test', requesters: [], name: 'Private', email: 'reader@example.test', phone: '1', address: { line1: 'Private', city: 'Town', postalCode: '10000', country: 'US' } })
  }
  async function reserve(id: string) {
    const token = crypto.randomUUID()
    await sql`INSERT INTO gift_reservations(id, request_id, items, expires_at)
      SELECT ${token}, id, items, now() + interval '30 minutes' FROM book_requests WHERE id = ${id}`
    return token
  }
  function gift(token: string, id = crypto.randomUUID()) {
    return { id, type: 'payment.completed', version: 1, data: { id: `payment-${id}`, amount: 2500, status: 'succeeded', currency: 'usd', campaign_id: 'campaign', buyer: { email: 'donor@example.test' }, buyer_questions: [{ question: 'Code', answer: token }] } }
  }
  it('allocates a replayed gift once, under concurrent delivery', async () => {
    const r = await request()
    const payment = gift(await reserve(r.id))
    await Promise.all([zeffy.recordZeffyGift(payment), zeffy.recordZeffyGift(payment)])
    expect((await requests.getRequest(r.id))?.status).toBe('funded_awaiting_order')
    const rows = await sql`SELECT * FROM ministry_gifts WHERE payment_id = ${payment.data.id}`
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ allocation: 'request', request_id: r.id })
    const notices = await sql`SELECT id FROM ministry_outbox WHERE id IN (${`gift:${payment.data.id}`}, ${`task:${r.id}`})`
    expect(notices).toHaveLength(2)
  })
  it('splits a partial gift atomically and leaves only unfunded copies open', async () => {
    const r = await request()
    const all = [{ slug: 'the-doctrine-of-simony', quantity: 3 }]
    const chosen = [{ slug: 'the-doctrine-of-simony', quantity: 1 }]
    await sql`UPDATE book_requests SET items = ${JSON.stringify(all)}::jsonb, message = 'partial-test' WHERE id = ${r.id}`
    const token = await reserve(r.id)
    await sql`UPDATE gift_reservations SET original_items = items, items = ${JSON.stringify(chosen)}::jsonb WHERE id = ${token}`
    const payment = gift(token)
    await zeffy.recordZeffyGift(payment)
    await zeffy.recordZeffyGift(payment)
    const rows = await sql`SELECT status, items FROM book_requests WHERE message = 'partial-test' ORDER BY status`
    expect(rows).toEqual([
      { status: 'funded_awaiting_order', items: chosen },
      { status: 'open', items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }] }
    ])
  })
  it('hides listings and direct public links while retaining owner access', async () => {
    const r = await request()
    await sql`UPDATE book_requests SET hidden = true WHERE id = ${r.id}`
    const list = (await import('../server/api/requests/index.get')).default
    const direct = (await import('../server/api/requests/[id].get')).default
    expect((await list({} as never)).some(row => row.id === r.id)).toBe(false)
    await expect(direct({ id: r.id } as never)).rejects.toMatchObject({ statusCode: 404 })
    expect((await requests.listRequestsForOwner('reader@example.test', [])).some(row => row.id === r.id)).toBe(true)
    const identity = { provider: 'github', subject: 'subject' }
    await sql`UPDATE book_requests SET requesters = ${JSON.stringify([identity])}::jsonb WHERE id = ${r.id}`
    expect((await requests.listRequestsForOwner(undefined, ['github:subject'])).some(row => row.id === r.id)).toBe(true)
    expect((await requests.listRequestsForOwner(undefined, ['github:other'])).some(row => row.id === r.id)).toBe(false)
  })
  it('allocates only one of two competing gifts to the request', async () => {
    const r = await request()
    const token = await reserve(r.id)
    const a = gift(token)
    const b = gift(token)
    await Promise.all([zeffy.recordZeffyGift(a), zeffy.recordZeffyGift(b)])
    const rows = await sql`SELECT allocation FROM ministry_gifts WHERE payment_id IN (${a.data.id}, ${b.data.id})`
    expect(rows.map(r => r.allocation).sort()).toEqual(['general', 'request'])
  })
  it('keeps gifts for hidden, withdrawn, expired, and missing recommendations in the general balance', async () => {
    for (const state of ['hidden', 'withdrawn', 'expired', 'missing']) {
      const r = await request()
      const token = await reserve(r.id)
      if (state === 'hidden') await sql`UPDATE book_requests SET hidden = true WHERE id = ${r.id}`
      if (state === 'withdrawn') await requests.deleteRequest(r.id)
      if (state === 'expired') await sql`UPDATE gift_reservations SET expires_at = now() - interval '1 minute' WHERE id = ${token}`
      const payment = gift(state === 'missing' ? '' : token)
      await zeffy.recordZeffyGift(payment)
      expect((await sql`SELECT allocation FROM ministry_gifts WHERE payment_id = ${payment.data.id}`)[0]!.allocation).toBe('general')
    }
  })
  it('checks role revocation and atomically claims tasks', async () => {
    const r = await request()
    await expect(ministry.requireAdministrator({ accountId: 'ordinary' } as never)).rejects.toMatchObject({ statusCode: 403 })
    for (const id of ['admin-a', 'admin-b']) await sql`INSERT INTO reader_accounts(id, created_at, updated_at) VALUES (${id}, 'now', 'now')`
    for (const id of ['admin-a', 'admin-b']) await sql`INSERT INTO account_roles(account_id, role, granted_by) VALUES (${id}, 'fulfillment_admin', 'test')`
    const results = await Promise.allSettled(['admin-a', 'admin-b'].map(accountId => adminHandler({ accountId, id: r.id, body: { action: 'claim' } })))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    await adminHandler({ accountId: 'admin-a', id: r.id, body: { action: 'visibility', hidden: true } })
    expect((await requests.getRequest(r.id))?.hidden).toBe(true)
    expect((await requests.getRequest(r.id))?.status).toBe('open')
    await sql`DELETE FROM account_roles WHERE account_id = 'admin-a'`
    await expect(ministry.requireAdministrator({ accountId: 'admin-a' } as never)).rejects.toMatchObject({ statusCode: 403 })
  })
  it('persists ordering, tracking, audit, and replay-safe delivery notifications', async () => {
    const r = await request()
    await zeffy.recordZeffyGift(gift(await reserve(r.id)))
    const event = (body: Record<string, unknown>) => ({ accountId: 'admin-b', id: r.id, body })
    await adminHandler(event({ action: 'claim' }))
    await adminHandler(event({ action: 'details', maximumCents: 3000, marketplace: 'https://www.amazon.com', paymentMethod: 'Church Visa ending 1234' }))
    await adminHandler(event({ action: 'ordered', amazonOrderNumber: '123-1234567-1234567', actualCents: 2500 }))
    expect((await requests.getRequest(r.id))?.status).toBe('ordered')
    await adminHandler(event({ action: 'tracking', trackingUrl: 'https://www.ups.com/track?tracknum=1Z123456789' }))
    expect((await requests.getRequest(r.id))?.status).toBe('done')
    await sql`UPDATE book_requests SET fulfillment = fulfillment || '{"trackerId":"trk_test"}'::jsonb WHERE id = ${r.id}`
    const { applyTrackingEvent } = await import('../server/utils/tracking')
    const tracker = { id: 'trk_test', status: 'delivered', updated_at: new Date().toISOString(), carrier: 'UPS', tracking_code: '1Z123456789' }
    await applyTrackingEvent('event-1', tracker)
    await applyTrackingEvent('event-1', tracker)
    await applyTrackingEvent('event-2', { ...tracker, updated_at: new Date(Date.now() + 1000).toISOString() })
    await applyTrackingEvent('event-old', { ...tracker, status: 'in_transit', updated_at: '2000-01-01T00:00:00Z' })
    expect((await requests.getRequest(r.id))?.fulfillment?.deliveryStatus).toBe('delivered')
    const emails = await sql`SELECT id FROM ministry_outbox WHERE id LIKE 'tracking:%' AND id LIKE ${'%:' + r.id}`
    expect(emails).toHaveLength(1)
    await adminHandler(event({ action: 'tracking', trackingUrl: '' }))
    expect((await requests.getRequest(r.id))?.status).toBe('ordered')
  }, 30000)
  it('updates existing public requests and protects the selected primary during concurrent changes', async () => {
    await sql`INSERT INTO reader_accounts(id, created_at, updated_at) VALUES ('profiles-reader', 'now', 'now')`
    const r = await request()
    await sql`UPDATE book_requests SET account_id = 'profiles-reader' WHERE id = ${r.id}`
    for (const subject of ['first', 'second']) {
      const identity = { provider: 'github', subject, name: subject, confirmation: 'control', verifiedAt: 'now' }
      await sql`INSERT INTO reader_identities(account_id, provider, subject, identity, provider_email, attached_at, last_verified_at)
        VALUES ('profiles-reader', 'github', ${subject}, ${JSON.stringify(identity)}::jsonb, 'secret@example.test', ${subject}, 'now')`
    }
    const event = { accountId: 'profiles-reader' } as never
    expect((await accounts.listAttachedIdentities(event)).identities.find(i => i.primary)?.subject).toBe('first')
    await expect(accounts.detachIdentity(event, 'github:first')).rejects.toMatchObject({ statusCode: 409 })
    await expect(accounts.setPrimaryIdentity('profiles-reader', 'github:foreign')).rejects.toMatchObject({ statusCode: 422 })
    await accounts.setPrimaryIdentity('profiles-reader', 'github:second')
    const list = (await import('../server/api/requests/index.get')).default
    const publicRequest = (await list({} as never)).find(row => row.id === r.id)!
    expect(publicRequest.requesters).toHaveLength(2)
    expect(publicRequest.requesters.find(i => i.primary)?.subject).toBe('second')
    expect(JSON.stringify(publicRequest)).not.toContain('secret@example.test')
    expect((await requests.getRequest(r.id))?.requesters).toEqual([])
    await Promise.allSettled([
      accounts.setPrimaryIdentity('profiles-reader', 'github:first'),
      accounts.detachIdentity(event, 'github:first')
    ])
    const remaining = (await accounts.listAttachedIdentities(event)).identities
    expect(remaining.filter(i => i.primary)).toHaveLength(1)
    await expect(accounts.detachIdentity(event, `github:${remaining.find(i => i.primary)!.subject}`)).rejects.toMatchObject({ statusCode: 409 })
  })
  it('does not overwrite edits or funding that happened after an edit began', async () => {
    const r = await request()
    const increased = [{ slug: 'the-doctrine-of-simony', quantity: 3 }]
    expect((await requests.updateRequest(r.id, { items: increased }, r))?.items).toEqual(increased)
    expect(await requests.updateRequest(r.id, { items: r.items }, r)).toBeNull()
    const latest = (await requests.getRequest(r.id))!
    await zeffy.recordZeffyGift(gift(await reserve(r.id)))
    expect(await requests.updateRequest(r.id, { items: r.items }, latest)).toBeNull()
    expect(await requests.updateRequest(r.id, { items: r.items })).toBeNull()
    expect((await requests.getRequest(r.id))?.items).toEqual(increased)
  })
  it('two simultaneous detach requests leave one identity', async () => {
    await sql`INSERT INTO reader_accounts(id, created_at, updated_at) VALUES ('reader', 'now', 'now')`
    for (const subject of ['one', 'two']) await sql`INSERT INTO reader_identities(account_id, provider, subject, identity, attached_at, last_verified_at)
      VALUES ('reader', 'github', ${subject}, '{}'::jsonb, 'now', 'now')`
    const results = await Promise.allSettled(['one', 'two'].map(s => accounts.detachIdentity({ accountId: 'reader' } as never, `github:${s}`)))
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
    expect((await sql`SELECT subject FROM reader_identities WHERE account_id = 'reader'`)).toHaveLength(1)
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { statusCode: 409, statusMessage: 'LAST_IDENTITY' } })
  })
})
