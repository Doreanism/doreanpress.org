// Who is allowed to change a posting on the Give a Book board.
//
// Before the identity challenge existed, the request's unguessable id was the
// whole capability: whoever held the link from the confirmation email could edit
// or withdraw it. Now the account is the authority and the id is just an
// address — you prove the account again, and we match that fresh proof against
// the identity stored on the request.

import type { H3Event } from 'h3'
import { isSameAccount } from '#shared/identity'
import type { BookRequest } from './requests'

/**
 * Throws unless the caller has just shown the account behind this request.
 *
 * Rows posted before the challenge existed have no account to compare against,
 * so they keep the old link-is-the-key rule. That is no weaker than the day they
 * were posted, and the alternative — refusing everyone — would strand readers
 * who can no longer withdraw their own request.
 *
 * Be clear about what this is worth on a request whose account was *named*
 * rather than proved. The handle is printed on the board, so anyone can go and
 * get a matching `existence` proof for it and satisfy the check below. It is a
 * speed bump, not authorisation. It is kept anyway because it costs the reader
 * nothing and it does stop the idle case, but the real protection on those rows
 * is the same one legacy rows have always had — an unguessable id that arrives
 * by email — and that is the thing to strengthen if this ever matters. (It is
 * currently weaker than it reads: request ids are rendered on the public board,
 * so the withdraw link is not really a secret. Moving withdrawal onto its own
 * emailed token would fix both at once.)
 */
export async function requireRequestOwner(event: H3Event, request: BookRequest) {
  if (!request.requester) return

  const proof = await requireProof(event, 'changing your request')

  if (!isSameAccount(proof.identity, request.requester)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'This request was posted from a different account.'
    })
  }
}
