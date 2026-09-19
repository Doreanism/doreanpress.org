// Durable public identities attached to a reader account.
//
// Provider callbacks authenticate an identity once and persist it in Postgres.
// The sealed browser cookie contains only the internal account id and a compact
// sign-in summary; full provider profiles never ride in the cookie. This removes
// the old four-profile ceiling and lets any attached provider identity recover
// the same account on a later browser.

import type { H3Event } from 'h3'
import type { IdentityProof, RequesterIdentity } from '#shared/identity'
import { attachIdentity, detachIdentity, listAttachedIdentities } from './readerAccounts'

export async function issueProof(
  event: H3Event,
  identity: Omit<RequesterIdentity, 'verifiedAt'>,
  email?: string
): Promise<void> {
  const verified: RequesterIdentity = {
    ...identity,
    verifiedAt: new Date().toISOString()
  }
  const signedIn = await attachIdentity(event, verified, email)
  await replaceUserSession(event, { accountId: signedIn.accountId, signedIn })
}

/**
 * The historical name is retained for callers: these are now durable database
 * records rather than short-lived proof objects sealed into a cookie.
 */
export async function readProofs(event: H3Event): Promise<IdentityProof[]> {
  const { identities, email } = await listAttachedIdentities(event)
  return identities.map(identity => ({
    id: `${identity.provider}:${identity.subject}`,
    identity,
    email
  }))
}

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

export async function requireIdentities(event: H3Event, action: string): Promise<RequesterIdentity[]> {
  return (await requireProofs(event, action)).map(proof => proof.identity)
}

export async function discardProofs(event: H3Event, key?: string): Promise<void> {
  await detachIdentity(event, key)
}
