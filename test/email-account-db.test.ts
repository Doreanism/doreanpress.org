// ACCOUNT_DB_TEST=1 node --env-file=.env node_modules/vitest/vitest.mjs run test/email-account-db.test.ts
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { neon, neonConfig } from '@neondatabase/serverless'

describe.skipIf(process.env.ACCOUNT_DB_TEST !== '1')('email account database boundaries', { timeout: 30000 }, () => {
  const schema = `email_test_${Date.now()}`
  let raw: ReturnType<typeof neon>
  let sql: ReturnType<typeof neon>
  let links: typeof import('../server/utils/loginLink')
  let accounts: typeof import('../server/utils/readerAccounts')
  beforeAll(async () => {
    const endpoint = process.env.NEON_LOCAL_PROXY_ENDPOINT || ''
    if (!['localhost', '127.0.0.1'].includes(new URL(endpoint).hostname)) throw Error('Requires local proxy')
    neonConfig.fetchEndpoint = endpoint
    raw = neon(process.env.DATABASE_URL!)
    await raw.query(`CREATE SCHEMA ${schema}`)
    sql = Object.assign((strings: TemplateStringsArray, ...values: unknown[]) => {
      const mapped = strings.map(s => s.replace(/\b(email_login_links|reader_accounts|reader_emails|reader_identities|book_requests|orders|account_roles|ministry_audit|gift_reservations|ministry_gifts|ministry_outbox|ministry_tracking_events)\b/g, `${schema}.$1`))
      return raw(Object.assign(mapped, { raw: mapped }), ...values)
    }, { transaction: raw.transaction }) as typeof raw
    vi.stubGlobal('db', () => sql)
    vi.stubGlobal('normalizeEmail', (s: string) => s.trim().toLowerCase())
    vi.stubGlobal('getUserSession', (e: unknown) => e)
    vi.stubGlobal('createError', (e: object) => Object.assign(new Error('Unauthorized'), e))
    vi.stubGlobal('requireEmailAccount', async (e: { accountId?: string, email?: string }) => {
      if (!e.email) throw Object.assign(new Error('Sign in'), { statusCode: 401 })
      return e
    })
    links = await import('../server/utils/loginLink')
    accounts = await import('../server/utils/readerAccounts')
  })
  afterAll(async () => {
    if (raw) await raw.query(`DROP SCHEMA ${schema} CASCADE`)
    vi.unstubAllGlobals()
  })
  it('allows only five concurrent sends, even after a successful login', async () => {
    const issued = await Promise.all(Array.from({ length: 12 }, () => links.issueLoginLink('limit@example.test')))
    expect(issued.filter(Boolean)).toHaveLength(5)
    const first = await links.issueLoginLink('reuse@example.test')
    expect(await links.consumeLoginLink(first!)).toMatchObject({ email: 'reuse@example.test' })
    for (let n = 0; n < 4; n++) expect(await links.issueLoginLink('reuse@example.test')).toBeTruthy()
    expect(await links.issueLoginLink('reuse@example.test')).toBeNull()
  })
  it('consumes a link exactly once under concurrent verification', async () => {
    const code = await links.issueLoginLink('replay@example.test')
    const results = await Promise.all(Array.from({ length: 10 }, () => links.consumeLoginLink(code!)))
    expect(results.filter(Boolean)).toHaveLength(1)
  })
  it('rejects expired and superseded links and preserves the return path', async () => {
    const old = await links.issueLoginLink('replace@example.test')
    const latest = await links.issueLoginLink('replace@example.test', '/profiles')
    expect(await links.consumeLoginLink(old!)).toBeNull()
    expect(await links.consumeLoginLink(latest!)).toEqual({ email: 'replace@example.test', redirect: '/profiles' })
    const expired = await links.issueLoginLink('expired@example.test')
    await sql`UPDATE email_login_links SET expires_at = now() - interval '1 second' WHERE email = 'expired@example.test'`
    expect(await links.consumeLoginLink(expired!)).toBeNull()
  })
  it('recovers one durable account and does not merge different inboxes', async () => {
    const first = await accounts.attachEmail({} as never, 'one@example.test')
    const again = await accounts.attachEmail({} as never, ' ONE@EXAMPLE.TEST ')
    expect(again.accountId).toBe(first.accountId)
    const second = await accounts.attachEmail(first as never, 'two@example.test')
    expect(second.accountId).not.toBe(first.accountId)
    expect((await accounts.attachEmail({} as never, 'one@example.test')).accountId).toBe(first.accountId)
  })
  it('requires email before attaching and refuses another account’s profile', async () => {
    const identity = { provider: 'github', subject: '42', name: 'Reader', confirmation: 'control', verifiedAt: new Date().toISOString() } as const
    await expect(accounts.attachIdentity({} as never, identity)).rejects.toMatchObject({ statusCode: 401 })
    const first = await accounts.attachEmail({} as never, 'profile@example.test')
    await accounts.attachIdentity(first as never, identity)
    const second = await accounts.attachEmail({} as never, 'other@example.test')
    await expect(accounts.attachIdentity(second as never, identity)).rejects.toMatchObject({ statusCode: 409 })
  })
  it('requires the original account to consume an add-email link', async () => {
    const token = await links.issueLoginLink('bound@example.test', '/profiles', 'account-1')
    expect(await links.consumeLoginLink(token!)).toBeNull()
    expect(await links.consumeLoginLink(token!, 'account-2')).toBeNull()
    expect(await links.consumeLoginLink(token!, 'account-1')).toMatchObject({ accountId: 'account-1', email: 'bound@example.test' })
    expect(await links.consumeLoginLink(token!, 'account-1')).toBeNull()
  })
  it('signs in through secondary emails and routes notifications to the current primary', async () => {
    const first = await accounts.attachEmail({} as never, 'primary@example.test')
    await accounts.addVerifiedEmail(first.accountId, 'secondary@example.test')
    const secondary = await accounts.attachEmail({} as never, 'secondary@example.test')
    expect(secondary.accountId).toBe(first.accountId)
    expect(secondary.email).toBe('primary@example.test')
    await accounts.setPrimaryEmail(first.accountId, 'secondary@example.test')
    expect(await accounts.primaryNotificationEmail('primary@example.test', first.accountId)).toBe('secondary@example.test')
    await accounts.removeAccountEmail(first.accountId, 'primary@example.test')
    expect(await accounts.accountEmails(first.accountId)).toEqual([{ email: 'secondary@example.test', primary: true }])
    expect(await accounts.primaryNotificationEmail('primary@example.test', first.accountId)).toBe('secondary@example.test')
    await expect(accounts.removeAccountEmail(first.accountId, 'secondary@example.test')).rejects.toMatchObject({ statusCode: 409 })
  })
  it('refuses unverified primaries and addresses already owned by another account', async () => {
    const one = await accounts.attachEmail({} as never, 'owner-one@example.test')
    const two = await accounts.attachEmail({} as never, 'owner-two@example.test')
    await expect(accounts.setPrimaryEmail(one.accountId, 'unverified@example.test')).rejects.toMatchObject({ statusCode: 422 })
    await expect(accounts.addVerifiedEmail(one.accountId, 'owner-two@example.test')).rejects.toMatchObject({ statusCode: 409 })
    expect((await accounts.attachEmail({} as never, 'owner-two@example.test')).accountId).toBe(two.accountId)
  })
  it('preserves a primary email when primary changes race with removals', async () => {
    const account = await accounts.attachEmail({} as never, 'race-one@example.test')
    await accounts.addVerifiedEmail(account.accountId, 'race-two@example.test')
    await Promise.allSettled([
      accounts.setPrimaryEmail(account.accountId, 'race-two@example.test'),
      accounts.removeAccountEmail(account.accountId, 'race-one@example.test'),
      accounts.removeAccountEmail(account.accountId, 'race-two@example.test')
    ])
    const emails = await accounts.accountEmails(account.accountId)
    expect(emails.length).toBeGreaterThanOrEqual(1)
    expect(emails.filter(e => e.primary)).toHaveLength(1)
  })

  it('keeps old requests owned and sends queued shipping notices to the new primary', async () => {
    const requests = await import('../server/utils/requests')
    const ministry = await import('../server/utils/ministry')
    for (const [name, fn] of Object.entries({ ...accounts, ...requests, ...ministry })) vi.stubGlobal(name, fn)
    const { claimAccountRecords } = await import('../server/utils/accountRecords')
    const account = await accounts.attachEmail({} as never, 'history-old@example.test')
    await accounts.addVerifiedEmail(account.accountId, 'history-new@example.test')
    await ministry.ensureMinistrySchema()
    const request = await requests.createRequest({ items: [{ slug: 'the-doctrine-of-simony', quantity: 1 }], message: 'Test', requesters: [], name: 'Reader', email: 'history-old@example.test', phone: '1', address: { line1: '1 Main', city: 'Town', postalCode: '10000', country: 'US' } })
    await sql`INSERT INTO ministry_outbox(id, recipient, subject, body) VALUES ('history-shipping', 'history-old@example.test', 'Shipping update', 'Shipped')`
    await claimAccountRecords(account.accountId)
    await accounts.setPrimaryEmail(account.accountId, 'history-new@example.test')
    await accounts.removeAccountEmail(account.accountId, 'history-old@example.test')
    expect((await requests.listRequestsForOwner('history-new@example.test', [], account.accountId)).map(r => r.id)).toContain(request.id)
    const replacement = await accounts.attachEmail({} as never, 'history-old@example.test')
    await claimAccountRecords(replacement.accountId)
    expect(await requests.listRequestsForOwner('history-old@example.test', [], replacement.accountId)).toHaveLength(0)
    const send = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('sendEmail', send)
    await ministry.flushMinistryEmails()
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'history-new@example.test', subject: 'Shipping update' }), true)
    const { readSignedIn } = await import('../server/utils/signedIn')
    expect((await readSignedIn({ signedIn: account } as never))?.email).toBe('history-new@example.test')
  })
})
