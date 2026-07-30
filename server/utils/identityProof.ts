// Reading and spending a completed identity challenge.
//
// The whole lifecycle is: a reader raises a challenge, the provider hands them
// back, the proof sits in a sealed cookie only until the action it was raised
// for lands, and then it is spent. Nothing here logs anybody in — there is no
// account to be in, and a proof that has been spent is simply gone.
//
// Spending has to be recorded server-side. Clearing the cookie only asks the
// browser to forget it; the sealed value itself stays cryptographically valid
// until it expires, so a copy kept anywhere else — a proxy log, a shared
// machine, a curl session — would otherwise go on working. Recording the id is
// what makes "spent" true rather than merely polite.

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
 * Exported because a proof can end in three ways and all of them are final: it
 * is spent on an action, deliberately abandoned (the reader wants to show a
 * different account), or replaced by a fresh challenge. Burning all three keeps
 * "this proof is over" from depending on the browser having dropped a cookie.
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
 * Spend the proof: record the id as used, then drop the cookie.
 *
 * Called the moment the action it was raised for has actually happened, so a
 * proof is never available to a second action. This is what keeps the model a
 * challenge rather than a session — the next thing the reader does needs a fresh
 * round trip to the provider.
 */
export async function spendProof(event: H3Event): Promise<void> {
  const session = await getUserSession(event)
  const id = session.proof?.id

  await clearUserSession(event)
  if (id) await burnProof(event, id)
}
