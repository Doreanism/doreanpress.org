// The durable reader account in this browser, authenticated by an emailed sign-in link.

import type { H3Event } from 'h3'
import type { SignedIn } from '#shared/account'
import { attachEmail, readAccount } from './readerAccounts'

/**
 * Recover the account for a verified inbox, or create it on first sign-in.
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
  if (!signedIn?.accountId) return null
  const account = await readAccount(signedIn.accountId)
  if (!account) return null
  return { ...signedIn, email: account.email || undefined, label: account.email || signedIn.label }
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
 * End this browser session. Durable profile links remain attached to the account
 * for the next email sign-in.
 */
export async function signOut(event: H3Event): Promise<void> {
  await clearUserSession(event)
}

/** Email verification is required before linking profiles or requesting books. */
export async function requireEmailAccount(event: H3Event, action: string): Promise<SignedIn & { email: string }> {
  const signedIn = await requireSignedIn(event, action)
  if (!signedIn.email) {
    throw createError({ statusCode: 401, statusMessage: `Please sign in with your email before ${action}.` })
  }
  return signedIn as SignedIn & { email: string }
}
