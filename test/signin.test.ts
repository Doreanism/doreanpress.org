// Signing in by mailed code, and the boundary it must not cross.
//
// The database is stubbed rather than run: these are about the rules — expiry,
// single use, the attempt ceiling, and above all that a sign-in never turns into
// a proof — not about Postgres. `db()` is Nitro's auto-imported handle, so the
// stub stands in for the tagged-template client the utils call.
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * A tiny stand-in for the `neon` tagged-template client.
 *
 * Answers are matched on a fragment of the SQL rather than queued in order:
 * these functions also create tables and prune, and a positional queue silently
 * feeds the schema statement the row meant for the query under test — which is
 * exactly how the first draft of this file passed while testing nothing.
 */
function stubDb(answers: Record<string, unknown[]> = {}) {
  const seen: string[] = []
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?')
    seen.push(text)
    void values
    for (const [fragment, rows] of Object.entries(answers)) {
      if (text.includes(fragment)) return Promise.resolve(rows)
    }
    return Promise.resolve([])
  }
  vi.stubGlobal('db', () => sql)
  return { seen }
}

const { normalizeEmail, issueLoginCode, checkLoginCode } = await import('../server/utils/loginCode')

let stub: ReturnType<typeof stubDb>
afterEach(() => vi.unstubAllGlobals())

describe('normalizeEmail', () => {
  it('matches addresses the way people type them', () => {
    expect(normalizeEmail('  Reader@Example.COM ')).toBe('reader@example.com')
    expect(normalizeEmail('')).toBe('')
  })
})

describe('issuing a code', () => {
  it('mints six digits and stores them hashed, never in clear', async () => {
    stub = stubDb({ 'count(*)': [{ n: 0 }] })
    const code = await issueLoginCode('reader@example.com')

    expect(code).toMatch(/^\d{6}$/)
    // The insert must not carry the code itself. If this ever fails, a database
    // dump or a query log hands over live codes for other people's inboxes.
    const insert = stub.seen.find(s => s.includes('INSERT INTO login_codes'))
    expect(insert).toBeTruthy()
    expect(insert).toContain('code_hash')
  })

  it('refuses once an address has asked too often', async () => {
    stub = stubDb({ 'count(*)': [{ n: 5 }] })
    expect(await issueLoginCode('reader@example.com')).toBeNull()
    // and nothing was written for an address being hammered
    expect(stub.seen.some(s => s.includes('INSERT INTO login_codes'))).toBe(false)
  })
})

describe('checking a code', () => {
  const future = () => new Date(Date.now() + 5 * 60_000).toISOString()
  const past = () => new Date(Date.now() - 60_000).toISOString()

  // Mirrors the hashing in loginCode.ts, so a test row looks like a real one.
  async function hashed(email: string, code: string) {
    const { createHash } = await import('node:crypto')
    return createHash('sha256').update(`${email}:${code}`).digest('hex')
  }

  it('accepts the right code', async () => {
    stub = stubDb({ 'SELECT code_hash': [{ code_hash: await hashed('reader@example.com', '123456'), expires_at: future(), attempts: 0 }] })
    expect(await checkLoginCode('reader@example.com', '123456')).toBe('ok')
  })

  it('spends the code, so it cannot be replayed', async () => {
    stub = stubDb({ 'SELECT code_hash': [{ code_hash: await hashed('reader@example.com', '123456'), expires_at: future(), attempts: 0 }] })
    await checkLoginCode('reader@example.com', '123456')
    expect(stub.seen.some(s => s.includes('DELETE FROM login_codes'))).toBe(true)
  })

  it('rejects a wrong code and charges an attempt', async () => {
    stub = stubDb({ 'SELECT code_hash': [{ code_hash: await hashed('reader@example.com', '123456'), expires_at: future(), attempts: 0 }] })
    expect(await checkLoginCode('reader@example.com', '000000')).toBe('invalid')
    expect(stub.seen.some(s => s.includes('attempts = attempts + 1'))).toBe(true)
  })

  it('rejects an expired code', async () => {
    stub = stubDb({ 'SELECT code_hash': [{ code_hash: await hashed('reader@example.com', '123456'), expires_at: past(), attempts: 0 }] })
    expect(await checkLoginCode('reader@example.com', '123456')).toBe('expired')
  })

  it('stops guessing at the ceiling', async () => {
    stub = stubDb({ 'SELECT code_hash': [{ code_hash: await hashed('reader@example.com', '123456'), expires_at: future(), attempts: 4 }] })
    expect(await checkLoginCode('reader@example.com', '999999')).toBe('too-many-attempts')
  })

  it('says the same thing for an address it has never seen', async () => {
    // No row at all — indistinguishable from a wrong code, on purpose. Anything
    // else would answer "does this person use Dorean Press".
    stub = stubDb({})
    expect(await checkLoginCode('stranger@example.com', '123456')).toBe('invalid')
  })
})
