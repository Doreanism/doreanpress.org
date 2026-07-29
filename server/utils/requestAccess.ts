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
 * Throws unless the caller has just proved they hold the account behind this
 * request.
 *
 * Rows posted before the challenge existed have no account to compare against,
 * so they keep the old link-is-the-key rule. That is no weaker than the day they
 * were posted, and the alternative — refusing everyone — would strand readers
 * who can no longer withdraw their own request.
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
