// Reading and ending completed identity challenges.
//
// The whole lifecycle is: a reader raises a challenge, the provider hands them
// back, and the proof sits in a sealed cookie until it lapses or they discard
// it. Nothing here logs anybody in — there is no account to be in, and a proof
// that has ended is simply gone.
//
// A reader may attach several accounts to one request, so the cookie holds a
// *set* of proofs rather than one. Checking a second account therefore adds to
// what is held instead of replacing it — which is the one behaviour to keep in
// mind when changing anything below, because the previous version of this file
// burned the old proof on every new check and reintroducing that would silently
// drop the account a reader attached a moment ago.
//
// Within that window what is held covers everything the reader does: post a
// request, correct it, take it down. Each proof asserts one thing — this account
// is here — and the first action does not make that less true. Burning them per
// action instead put a full round trip to the provider in front of every click,
// which readers experienced as having to press each button twice.
//
// Ending has to be recorded server-side. Clearing the cookie only asks the
// browser to forget it; the sealed value itself stays cryptographically valid
// until it expires, so a copy kept anywhere else — a proxy log, a shared
// machine, a curl session — would otherwise go on working. Recording the id is
// what makes "over" true rather than merely polite.

import type { H3Event } from 'h3'
import { accountKey, MAX_ATTACHED, type IdentityProof, type RequesterIdentity } from '#shared/identity'

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

/**
 * Seal a checked account into the cookie, alongside any already there.
 *
 * The one place a proof is minted, for either kind of check — the challenge
 * routes, the lookup endpoint and the claim endpoint all land here, so there is
 * a single answer to "where do proofs come from" and a single place the
 * `confirmation` recorded on one can be trusted to have come from the code that
 * actually did the checking.
 *
 * Re-checking an account already attached replaces that entry rather than
 * doubling it, and burns the proof it replaces: the fresher check is the one
 * that should be spendable, and leaving the stale id valid would mean a proof
 * nothing points at any more still opening doors.
 *
 * Stored under `proofs`, never `user`: this is evidence, not a session.
 */
export async function issueProof(
  event: H3Event,
  identity: Omit<RequesterIdentity, 'verifiedAt'>,
  email?: string
): Promise<void> {
  const held = await readProofs(event)
  const key = accountKey(identity)

  // The same account checked again — by a stronger route, or just re-typed.
  const replaced = held.find(p => accountKey(p.identity) === key)
  if (replaced) await burnProof(event, replaced.id)

  const kept = held.filter(p => accountKey(p.identity) !== key)
  if (kept.length >= MAX_ATTACHED) {
    throw createError({
      statusCode: 400,
      statusMessage: `You can attach up to ${MAX_ATTACHED} profiles to a request. Remove one to add another.`
    })
  }

  const proof: IdentityProof = {
    id: crypto.randomUUID(),
    identity: { ...identity, verifiedAt: new Date().toISOString() },
    email: email || undefined
  }

  // `replaceUserSession`, not `setUserSession`: the latter merges the new value
  // over the old one key by key, which for an array means the shorter list
  // leaving the tail of the longer one in place — so removing an account would
  // not take. The whole set is written every time.
  await replaceUserSession(event, { proofs: [...kept, proof] })
}

/** Every account attached and still unspent, in the order attached. */
export async function readProofs(event: H3Event): Promise<IdentityProof[]> {
  const session = await getUserSession(event)
  const held = session.proofs ?? []
  if (held.length === 0) return []

  // Each id is checked, not just the first: proofs end one at a time, so a set
  // can hold a spent one beside live ones.
  const live = await Promise.all(
    held.map(async proof => (proof?.id && !(await isSpent(proof.id)) ? proof : null))
  )
  return live.filter((p): p is IdentityProof => p !== null)
}

/**
 * The accounts attached, or a 401 the client turns into a challenge prompt.
 *
 * `action` completes the sentence "attach a public account before …", so the
 * message names what the reader was trying to do.
 */
export async function requireProofs(event: H3Event, action: string): Promise<IdentityProof[]> {
  const proofs = await readProofs(event)
  if (proofs.length === 0) {
    throw createError({
      statusCode: 401,
      statusMessage: `Please attach a public account before ${action}.`
    })
  }
  return proofs
}

/** Just the accounts, which is what everything downstream of a check wants. */
export async function requireIdentities(event: H3Event, action: string): Promise<RequesterIdentity[]> {
  return (await requireProofs(event, action)).map(p => p.identity)
}

/**
 * End one attached account, or all of them.
 *
 * Record each id as finished, then write back what is left. For when the reader
 * is deliberately done with an account — removing one they attached, or starting
 * over — not after each action they take with it. Actions leave proofs alone and
 * let them lapse on their own, which is what keeps a second action from
 * demanding a second trip to the provider.
 */
export async function discardProofs(event: H3Event, key?: string): Promise<void> {
  const held = await readProofs(event)
  const going = key ? held.filter(p => accountKey(p.identity) === key) : held
  const staying = key ? held.filter(p => accountKey(p.identity) !== key) : []

  if (staying.length > 0) await replaceUserSession(event, { proofs: staying })
  else await clearUserSession(event)

  for (const proof of going) await burnProof(event, proof.id)
}
