// Who is allowed to change a posting on the Give a Book board.
//
// Before sign-in existed, the request's unguessable id was the whole
// capability: whoever held the link from the confirmation email could edit or
// withdraw it. Now that a request carries an account, the account is the
// authority and the id is just an address.

import type { H3Event } from 'h3'
import { isSameAccount } from '#shared/identity'
import type { BookRequest } from './requests'

/**
 * Throws unless the caller may modify this request.
 *
 * Rows posted before sign-in was required have no owner to compare against, so
 * they keep the old link-is-the-key rule. That is no weaker than the day they
 * were posted, and the alternative — refusing everyone — would strand readers
 * who can no longer withdraw their own request.
 */
export async function requireRequestOwner(event: H3Event, request: BookRequest) {
  if (!request.requester) return

  const { user } = await getUserSession(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Please sign in with the account you used to post this request.'
    })
  }

  if (!isSameAccount(user.identity, request.requester)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'This request belongs to a different account.'
    })
  }
}
