// The durable reader account in this browser. It may be recovered through any
// attached provider identity or linked to an inbox through a mailed code.

import type { H3Event } from 'h3'
import type { SignedIn } from '#shared/account'
import { attachEmail } from './readerAccounts'

/**
 * Link an authenticated inbox to the current account, merging it with an
 * existing account for that address when necessary.
 */
export async function signIn(event: H3Event, email: string): Promise<SignedIn> {
  const signedIn = await attachEmail(event, email)
  await replaceUserSession(event, { accountId: signedIn.accountId, signedIn })
  return signedIn
}

/** The signed-in address, or null. */
export async function readSignedIn(event: H3Event): Promise<SignedIn | null> {
  const session = await getUserSession(event)
  const signedIn = session.signedIn as SignedIn | undefined
  return signedIn?.accountId ? signedIn : null
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
 * End this browser session. Durable identities remain available as sign-in
 * methods in the database.
 */
export async function signOut(event: H3Event): Promise<void> {
  await clearUserSession(event)
}
