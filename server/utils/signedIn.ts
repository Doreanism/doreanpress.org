// Who is signed in, as opposed to what they have proved.
//
// Both live in the same sealed cookie and they are not the same thing, so they
// are read and written through different doors:
//
//   proofs    — `identityProof.ts`. A public account is yours. Minted at a
//               provider, worth twenty minutes, spent on one action, shown to
//               strangers on the board.
//   signed in — here. An inbox is yours. Minted by a mailed code, lasts as long
//               as the cookie, and is what finds your orders.
//
// Nothing here proves an account, so nothing here may stand in for a proof. The
// request form still calls `requireIdentities`, and being signed in must never
// satisfy it: an email address tells a giver nothing about who they are giving
// to, which is the entire job the challenge does.

import type { H3Event } from 'h3'

export interface SignedIn {
  email: string
  at: string
}

/**
 * Record the sign-in without disturbing any proofs already attached.
 *
 * `replaceUserSession` writes the whole session, so the proofs have to be
 * carried across by hand — the same trap `issueProof` documents, from the other
 * side. Reading them back through `getUserSession` rather than `readProofs` is
 * deliberate: this is a copy, not a check, and filtering here would silently
 * drop a reader's attached accounts as a side effect of signing in.
 */
export async function signIn(event: H3Event, email: string): Promise<SignedIn> {
  const session = await getUserSession(event)
  const signedIn: SignedIn = {
    email: normalizeEmail(email),
    at: new Date().toISOString()
  }
  await replaceUserSession(event, { proofs: session.proofs ?? [], signedIn })
  return signedIn
}

/** The signed-in address, or null. */
export async function readSignedIn(event: H3Event): Promise<SignedIn | null> {
  const session = await getUserSession(event)
  const signedIn = session.signedIn as SignedIn | undefined
  return signedIn?.email ? signedIn : null
}

/** The signed-in address, or a 401 the client turns into a sign-in prompt. */
export async function requireSignedIn(event: H3Event, action: string): Promise<SignedIn> {
  const signedIn = await readSignedIn(event)
  if (!signedIn) {
    throw createError({
      statusCode: 401,
      statusMessage: `Please sign in before ${action}.`
    })
  }
  return signedIn
}

/**
 * End the sign-in, keeping any proofs.
 *
 * Signing out is about the inbox, not about accounts a reader attached a moment
 * ago — clearing those too would make signing out silently undo the work of
 * filling in a request. They lapse on their own soon enough.
 */
export async function signOut(event: H3Event): Promise<void> {
  const session = await getUserSession(event)
  const proofs = session.proofs ?? []
  if (proofs.length > 0) await replaceUserSession(event, { proofs })
  else await clearUserSession(event)
}
