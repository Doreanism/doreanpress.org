// Reading and ending a completed identity challenge.
//
// The whole lifecycle is: a reader raises a challenge, the provider hands them
// back, and the proof sits in a sealed cookie until it lapses, they discard it,
// or a fresh challenge replaces it. Nothing here logs anybody in — there is no
// account to be in, and a proof that has ended is simply gone.
//
// Within that window one proof covers everything the reader does: post a
// request, correct it, take it down. It asserts one thing — this account is
// here — and the first action does not make that less true. Burning it per
// action instead put a full round trip to the provider in front of every click,
// which readers experienced as having to press each button twice.
//
// Ending has to be recorded server-side. Clearing the cookie only asks the
// browser to forget it; the sealed value itself stays cryptographically valid
// until it expires, so a copy kept anywhere else — a proxy log, a shared
// machine, a curl session — would otherwise go on working. Recording the id is
// what makes "over" true rather than merely polite.

import type { H3Event } from 'h3'
import type { IdentityProof } from '#shared/identity'

let schema: Promise<void> | null = null
function ensureSchema() {
  if (!schema) {
    schema = db()`
      CREATE TABLE IF NOT EXISTS spent_proofs (
        id       text PRIMARY KEY,
        spent_at text NOT NULL
      )
    `.then(() => undefined)
  }
  return schema
}

/** How long a proof can possibly be worth anything, from the cookie's own TTL. */
function proofLifetimeMs(event: H3Event): number {
  return (useRuntimeConfig(event).session.maxAge ?? 20 * 60) * 1000
}

async function isSpent(id: string): Promise<boolean> {
  await ensureSchema()
  const rows = await db()`SELECT 1 FROM spent_proofs WHERE id = ${id}`
  return rows.length > 0
}

/**
 * Mark a proof id as used up, so it is refused from then on.
 *
 * Exported because a proof can be ended two ways short of lapsing, and both are
 * final: deliberately abandoned (the reader wants to show a different account),
 * or replaced by a fresh challenge. Burning both keeps "this proof is over" from
 * depending on the browser having dropped a cookie.
 */
export async function burnProof(event: H3Event, id: string): Promise<void> {
  await ensureSchema()
  const sql = db()
  await sql`
    INSERT INTO spent_proofs (id, spent_at)
    VALUES (${id}, ${new Date().toISOString()})
    ON CONFLICT (id) DO NOTHING
  `

  // A proof cannot outlive its cookie, so once that window has passed the row
  // guards nothing. Pruned here rather than on a schedule: this path is rare,
  // and it keeps the table bounded without anything else to run. Doubled to stay
  // clear of clock skew between instances.
  const cutoff = new Date(Date.now() - proofLifetimeMs(event) * 2).toISOString()
  await sql`DELETE FROM spent_proofs WHERE spent_at < ${cutoff}`
}

/** The proof currently held and still unspent, or null. */
export async function readProof(event: H3Event): Promise<IdentityProof | null> {
  const session = await getUserSession(event)
  const proof = session.proof
  if (!proof?.id) return null
  return (await isSpent(proof.id)) ? null : proof
}

/**
 * The proof currently held, or a 401 the client turns into a challenge prompt.
 *
 * `action` completes the sentence "prove you hold a public account before …",
 * so the message names what the reader was trying to do.
 */
export async function requireProof(event: H3Event, action: string): Promise<IdentityProof> {
  const proof = await readProof(event)
  if (!proof) {
    throw createError({
      statusCode: 401,
      statusMessage: `Please prove you hold a public account before ${action}.`
    })
  }
  return proof
}

/**
 * End the proof now: record the id as finished, then drop the cookie.
 *
 * For when the reader is deliberately done with an account — "use a different
 * account" — not after each action they take with it. Actions leave the proof
 * alone and let it lapse on its own, which is what keeps a second action from
 * demanding a second trip to the provider.
 */
export async function discardProof(event: H3Event): Promise<void> {
  const session = await getUserSession(event)
  const id = session.proof?.id

  await clearUserSession(event)
  if (id) await burnProof(event, id)
}
