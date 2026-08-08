// Signing in by a code sent to an inbox.
//
// This is the site's first and only login, and it is deliberately the smallest
// one that works: email is already the identifier every order carries, so
// proving you can read an inbox is enough to be shown the orders that name it.
//
// It is not the identity challenge and does not replace it. A proof says a
// public account is yours and is what a stranger about to spend money is shown;
// this says an inbox is yours and is what the site uses to find your orders.
// Posting a request still requires the former — see `requireIdentities`.
//
// Codes are held the way `spent_proofs` holds ids: a small table, written on
// use, pruned on write, with no scheduled job to keep running.

import { createHash, randomInt, timingSafeEqual } from 'node:crypto'

/** Long enough to be worth guessing at, short enough to read off a phone. */
const CODE_LENGTH = 6

/** How long a mailed code is good for. */
const CODE_TTL_MS = 10 * 60 * 1000

/**
 * Guesses allowed before a code is burned.
 *
 * Six digits is a million possibilities, so this is not really about exhausting
 * the space — it is about a code sitting in a table staying guessable for ten
 * whole minutes if nobody counts.
 */
const MAX_ATTEMPTS = 5

/** New codes per address per window, so an inbox cannot be used as a weapon. */
const MAX_SENDS_PER_WINDOW = 5
const SEND_WINDOW_MS = 15 * 60 * 1000

let schema: Promise<void> | null = null
function ensureSchema() {
  if (!schema) {
    schema = db()`
      CREATE TABLE IF NOT EXISTS login_codes (
        email      text NOT NULL,
        code_hash  text NOT NULL,
        expires_at text NOT NULL,
        attempts   integer NOT NULL DEFAULT 0,
        created_at text NOT NULL
      )
    `.then(() => undefined)
  }
  return schema
}

/**
 * Addresses are matched, so they have to compare equal the way people type
 * them. Case and surrounding space carry no meaning in an address here — the
 * same normalisation the request rows want when looked up by email.
 */
export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

/**
 * Codes are stored hashed, never in clear.
 *
 * A six-digit code is not a password and this is not about slowing an attacker
 * down — it is that a database dump, a log line or a support screenshot should
 * not hand over a live code for someone else's inbox. It lives for ten minutes,
 * so a fast hash is the right shape.
 */
function hashCode(email: string, code: string): string {
  return createHash('sha256').update(`${normalizeEmail(email)}:${code}`).digest('hex')
}

/** Fixed-length compare, so a wrong code takes as long as a right one. */
function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  return left.length === right.length && timingSafeEqual(left, right)
}

async function prune(): Promise<void> {
  // Doubled to stay clear of clock skew between instances, as `burnProof` does.
  const cutoff = new Date(Date.now() - CODE_TTL_MS * 2).toISOString()
  await db()`DELETE FROM login_codes WHERE expires_at < ${cutoff}`
}

/**
 * Mint a code for an address and return it for sending.
 *
 * Returns null when the address has asked too often lately. The caller must
 * answer the reader the same way either way — see the route.
 *
 * Any code already outstanding for the address is dropped: asking again should
 * mean the newest mail is the one that works, rather than several live codes
 * accumulating for one inbox.
 */
export async function issueLoginCode(email: string): Promise<string | null> {
  await ensureSchema()
  await prune()

  const address = normalizeEmail(email)
  const sql = db()

  const since = new Date(Date.now() - SEND_WINDOW_MS).toISOString()
  const recent = await sql`
    SELECT count(*)::int AS n FROM login_codes
    WHERE email = ${address} AND created_at > ${since}
  `
  if (((recent[0]?.n as number) ?? 0) >= MAX_SENDS_PER_WINDOW) return null

  await sql`DELETE FROM login_codes WHERE email = ${address}`

  // `randomInt`, not `Math.random`: this is a credential, however short-lived.
  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0')
  const now = new Date()

  await sql`
    INSERT INTO login_codes (email, code_hash, expires_at, attempts, created_at)
    VALUES (
      ${address},
      ${hashCode(address, code)},
      ${new Date(now.getTime() + CODE_TTL_MS).toISOString()},
      0,
      ${now.toISOString()}
    )
  `

  return code
}

export type CodeCheck = 'ok' | 'invalid' | 'expired' | 'too-many-attempts'

/**
 * Check a code and, either way, use it up.
 *
 * A correct code is deleted so it cannot be replayed; a wrong one costs an
 * attempt and is deleted once the ceiling is reached. The distinct failures are
 * for the reader's benefit — "that code has expired, ask for another" is worth
 * saying — and none of them reveal whether the address has ever been used here.
 */
export async function checkLoginCode(email: string, code: string): Promise<CodeCheck> {
  await ensureSchema()

  const address = normalizeEmail(email)
  const attempt = String(code || '').trim()
  const sql = db()

  const rows = await sql`
    SELECT code_hash, expires_at, attempts FROM login_codes
    WHERE email = ${address}
    ORDER BY created_at DESC
    LIMIT 1
  `
  const row = rows[0]
  if (!row) return 'invalid'

  if (Date.parse(row.expires_at as string) < Date.now()) {
    await sql`DELETE FROM login_codes WHERE email = ${address}`
    return 'expired'
  }

  if (((row.attempts as number) ?? 0) + 1 >= MAX_ATTEMPTS) {
    await sql`DELETE FROM login_codes WHERE email = ${address}`
    if (!sameHash(row.code_hash as string, hashCode(address, attempt))) {
      return 'too-many-attempts'
    }
    return 'ok'
  }

  if (!sameHash(row.code_hash as string, hashCode(address, attempt))) {
    await sql`UPDATE login_codes SET attempts = attempts + 1 WHERE email = ${address}`
    return 'invalid'
  }

  await sql`DELETE FROM login_codes WHERE email = ${address}`
  return 'ok'
}
