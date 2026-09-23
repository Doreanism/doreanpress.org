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
  const config = { zeffy: { campaignId: 'campaign', recommendationQuestion: 'Code' }, giftEstimate: { firstCopyCents: 1200, additionalCopyCents: 700 }, public: { siteUrl: 'https://example.test' }, easypost: { apiKey: '' } }

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
  it('pools smaller gifts across codes and funds the whole request at the exact target', async () => {
    const r = await request()
    const a = gift(await reserve(r.id))
    a.data.amount = 500
    const b = gift(await reserve(r.id))
    b.data.amount = 400
    const c = gift(await reserve(r.id))
    c.data.amount = 300
    await zeffy.recordZeffyGift(a)
    await zeffy.recordZeffyGift(a)
    expect(await requests.getRequest(r.id)).toMatchObject({ status: 'open', fundedCents: 500, fundingTargetCents: 1200 })
    await zeffy.recordZeffyGift(b)
    expect(await requests.getRequest(r.id)).toMatchObject({ status: 'open', fundedCents: 900 })
    expect(await sql`SELECT id FROM ministry_outbox WHERE id = ${'task:' + r.id}`).toHaveLength(0)
    await zeffy.recordZeffyGift(c)
    expect(await requests.getRequest(r.id)).toMatchObject({ status: 'funded_awaiting_order', fundedCents: 1200 })
    expect(await sql`SELECT id FROM ministry_outbox WHERE id = ${'task:' + r.id}`).toHaveLength(1)
  })
  it('counts concurrent contributions once and allocates only the remaining cost', async () => {
    const r = await request()
    const a = gift(await reserve(r.id))
    const b = gift(await reserve(r.id))
    a.data.amount = 800
    b.data.amount = 800
    await Promise.all([zeffy.recordZeffyGift(a), zeffy.recordZeffyGift(b), zeffy.recordZeffyGift(a)])
    expect(await requests.getRequest(r.id)).toMatchObject({ status: 'funded_awaiting_order', fundedCents: 1200 })
    const [totals] = await sql`SELECT sum(amount_cents)::integer AS total, sum(allocated_cents)::integer AS allocated
      FROM ministry_gifts WHERE request_id = ${r.id}`
    expect(totals).toEqual({ total: 1600, allocated: 1200 })
  })
  it('does not split an older code’s selection or fund a three-copy request too early', async () => {
    const r = await request()
    const all = [{ slug: 'the-doctrine-of-simony', quantity: 3 }]
    await sql`UPDATE book_requests SET items = ${JSON.stringify(all)}::jsonb WHERE id = ${r.id}`
    const token = await reserve(r.id)
    await sql`UPDATE gift_reservations SET original_items = items, items = '[{"slug":"the-doctrine-of-simony","quantity":1}]'::jsonb WHERE id = ${token}`
    await zeffy.recordZeffyGift(gift(token))
    expect(await requests.getRequest(r.id)).toMatchObject({ status: 'open', items: all, fundedCents: 2500, fundingTargetCents: 2600 })
  })
  it('preserves contributions against edits and withdrawal', async () => {
    const r = await request()
    const payment = gift(await reserve(r.id))
    payment.data.amount = 500
    await zeffy.recordZeffyGift(payment)
    expect(await requests.updateRequest(r.id, { items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }] })).toBeNull()
    await expect(requests.deleteRequest(r.id)).rejects.toMatchObject({ statusCode: 409 })
    expect((await requests.listRequestsSponsoredBy('donor@example.test')).some(row => row.id === r.id)).toBe(true)
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
  it('accepts a delayed payment after the browsing reservation was released', async () => {
    const r = await request()
    const token = await reserve(r.id)
    await sql`UPDATE gift_reservations SET expires_at = now() - interval '1 minute' WHERE id = ${token}`
    const payment = gift(token)
    await zeffy.recordZeffyGift(payment)
    expect((await requests.getRequest(r.id))?.status).toBe('funded_awaiting_order')
    expect((await sql`SELECT allocation FROM ministry_gifts WHERE payment_id = ${payment.data.id}`)[0]!.allocation).toBe('request')
  })
  it('keeps gifts for hidden, withdrawn, and missing recommendations in the general balance', async () => {
    for (const state of ['hidden', 'withdrawn', 'missing']) {
      const r = await request()
      const token = await reserve(r.id)
      if (state === 'hidden') await sql`UPDATE book_requests SET hidden = true WHERE id = ${r.id}`
      if (state === 'withdrawn') await requests.deleteRequest(r.id)
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
  async function addressPair() {
    const accountId = crypto.randomUUID()
    const input = { accountId, items: [{ slug: 'the-doctrine-of-simony', quantity: 1 }], message: 'Source message', requesters: [], name: 'Reader', email: 'reader@example.test', phone: '', address: { line1: 'First street', city: 'Town', postalCode: '10000', country: 'US' } }
    const source = await requests.createRequest(input)
    const target = await requests.createRequest({ ...input, message: 'Target message', address: { ...input.address, line1: 'Other street' } })
    return { source, target, accountId }
  }
  it('merges addresses atomically, preserving quantities and messages without duplicate rows', async () => {
    const { planAddressEdit, saveAddressEdit } = await import('../server/utils/requestAddressEditing')
    const { source, target, accountId } = await addressPair()
    const plan = planAddressEdit(source, [source, target], accountId, { originalDestination: source, targetRequestId: target.id })
    expect(await saveAddressEdit(plan, accountId)).toEqual({ id: target.id, merged: true })
    expect(await requests.getRequest(source.id)).toBeNull()
    expect(await requests.getRequest(target.id)).toMatchObject({ items: [{ slug: 'the-doctrine-of-simony', quantity: 2 }], message: 'Target message\n\nSource message', address: target.address })
  })
  it('rejects stale and simultaneous merges without losing or doubling quantities', async () => {
    const { planAddressEdit, saveAddressEdit } = await import('../server/utils/requestAddressEditing')
    const { source, target, accountId } = await addressPair()
    const plan = planAddressEdit(source, [source, target], accountId, { originalDestination: source, targetRequestId: target.id })
    const results = await Promise.allSettled([saveAddressEdit(plan, accountId), saveAddressEdit(plan, accountId)])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { statusCode: 409 } })
    expect((await requests.getRequest(target.id))?.items[0]?.quantity).toBe(2)
  })
  it('does not merge during checkout, or after either order changes or gets funded', async () => {
    const { planAddressEdit, saveAddressEdit } = await import('../server/utils/requestAddressEditing')
    for (const which of ['source', 'target'] as const) {
      for (const change of ['reservation', 'edit', 'funding']) {
        const pair = await addressPair()
        const { source, target, accountId } = pair
        const plan = planAddressEdit(source, [source, target], accountId, { originalDestination: source, targetRequestId: target.id })
        if (change === 'reservation') await reserve(pair[which].id)
        if (change === 'edit') await requests.updateRequest(pair[which].id, { message: 'New message' })
        if (change === 'funding') await sql`UPDATE book_requests SET status = 'funded_awaiting_order' WHERE id = ${pair[which].id}`
        await expect(saveAddressEdit(plan, accountId)).rejects.toMatchObject({ statusCode: 409 })
        expect((await requests.getRequest(source.id))?.items).toEqual(source.items)
        expect((await requests.getRequest(target.id))?.items).toEqual(target.items)
      }
    }
  })
  it('updates to a funded order’s address without merging or modifying the funded order', async () => {
    const { planAddressEdit, saveAddressEdit } = await import('../server/utils/requestAddressEditing')
    const { source, target, accountId } = await addressPair()
    await sql`UPDATE book_requests SET status = 'ordered' WHERE id = ${target.id}`
    const funded = (await requests.getRequest(target.id))!
    const plan = planAddressEdit(source, [source, funded], accountId, { originalDestination: source, targetRequestId: target.id })
    expect(await saveAddressEdit(plan, accountId)).toEqual({ id: source.id, merged: false })
    expect((await requests.getRequest(source.id))?.address).toEqual(target.address)
    expect(await requests.getRequest(target.id)).toEqual(funded)
  })
  it('allows a funded address update but rejects an edit if shipping starts before saving', async () => {
    const { planAddressEdit, saveAddressEdit } = await import('../server/utils/requestAddressEditing')
    const { source, target, accountId } = await addressPair()
    await sql`UPDATE book_requests SET status = 'funded_awaiting_order' WHERE id = ${source.id}`
    const funded = (await requests.getRequest(source.id))!
    const plan = planAddressEdit(funded, [funded, target], accountId, { originalDestination: funded, targetRequestId: target.id })
    expect(await saveAddressEdit(plan, accountId)).toEqual({ id: source.id, merged: false })
    expect(await requests.getRequest(source.id)).toMatchObject({ status: 'funded_awaiting_order', items: source.items, address: target.address })
    expect(await requests.getRequest(target.id)).toMatchObject({ items: target.items, status: 'open' })
    const latest = (await requests.getRequest(source.id))!
    const stale = planAddressEdit(latest, [latest], accountId, { originalDestination: latest, name: source.name, address: source.address })
    await sql`UPDATE book_requests SET fulfillment = fulfillment || '{"deliveryStatus":"in_transit","shippedAt":"2026-09-22"}'::jsonb WHERE id = ${source.id}`
    await expect(saveAddressEdit(stale, accountId)).rejects.toMatchObject({ statusCode: 409 })
    expect((await requests.getRequest(source.id))?.address).toEqual(target.address)
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
  it('lets an administrator save tracking directly without claiming or recording an Amazon order', async () => {
    const r = await request()
    await zeffy.recordZeffyGift(gift(await reserve(r.id)))
    const getDetail = (await import('../server/api/admin/fulfillment/[id].get')).default
    expect(await getDetail({ accountId: 'admin-b', id: r.id } as never)).toMatchObject({ fundedCents: 1200 })
    await adminHandler({ accountId: 'admin-b', id: r.id, body: { action: 'cost', actualCents: 1350 } })
    expect(await requests.getRequest(r.id)).toMatchObject({ status: 'funded_awaiting_order', fulfillment: { actualCents: 1350 } })
    await adminHandler({ accountId: 'admin-b', id: r.id, body: {
      action: 'tracking', trackingUrl: 'https://www.ups.com/track?tracknum=1Z123456789'
    } })
    expect(await requests.getRequest(r.id)).toMatchObject({ status: 'done', fulfillment: { trackingSubmittedBy: 'admin-b', actualCents: 1350 } })
    await adminHandler({ accountId: 'admin-b', id: r.id, body: { action: 'tracking', trackingUrl: '' } })
    expect((await requests.getRequest(r.id))?.status).toBe('funded_awaiting_order')
  })
  it('shows the claiming admin email and saves the purchase before tracking', async () => {
    await sql`INSERT INTO reader_accounts(id, email, created_at, updated_at) VALUES ('purchase-admin', 'admin@example.test', 'now', 'now')`
    await sql`INSERT INTO account_roles(account_id, role, granted_by) VALUES ('purchase-admin', 'fulfillment_admin', 'test')`
    const r = await request()
    await zeffy.recordZeffyGift(gift(await reserve(r.id)))
    await adminHandler({ accountId: 'purchase-admin', id: r.id, body: { action: 'claim' } })
    vi.stubGlobal('getQuery', () => ({ status: 'pending' }))
    const list = (await import('../server/api/admin/fulfillment/index.get')).default
    expect((await list({ accountId: 'purchase-admin' } as never)).find(row => row.id === r.id)).toMatchObject({ claimedEmail: 'admin@example.test' })
    const privateOrderUrl = 'https://www.amazon.com/gp/your-account/order-details?orderID=123-1234567-1234567'
    await adminHandler({ accountId: 'purchase-admin', id: r.id, body: { action: 'purchase', actualCents: 941, privateOrderUrl } })
    expect(await requests.getRequest(r.id)).toMatchObject({ status: 'ordered', fulfillment: { actualCents: 941, privateOrderUrl } })
    const emails = await sql`SELECT body FROM ministry_outbox WHERE recipient = 'reader@example.test'`
    expect(JSON.stringify(emails)).not.toContain(privateOrderUrl)
  })
})
