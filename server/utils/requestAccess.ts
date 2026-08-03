// Who is allowed to change a posting on the Give a Book board.
//
// Before the identity challenge existed, the request's unguessable id was the
// whole capability: whoever held the link from the confirmation email could edit
// or withdraw it. Now the account is the authority and the id is just an
// address — you prove the account again, and we match that fresh proof against
// the identity stored on the request.

import type { H3Event } from 'h3'
import { sharesAccount } from '#shared/identity'
import type { BookRequest } from './requests'

/**
 * Throws unless the caller has just shown the account behind this request.
 *
 * Rows posted before the challenge existed have no account to compare against,
 * so they keep the old link-is-the-key rule. That is no weaker than the day they
 * were posted, and the alternative — refusing everyone — would strand readers
 * who can no longer withdraw their own request.
 *
 * Be clear about what this is worth on a request whose account was *named* or
 * merely *claimed* rather than proved. The handle is printed on the board, so
 * anyone can go and get a matching `existence` proof for it — or, on a claimed
 * row, simply type the same handle back in — and satisfy the check below. It is
 * a speed bump, not authorisation. It is kept anyway because it costs the reader
 * nothing and it does stop the idle case, but the real protection on those rows
 * is the same one legacy rows have always had — an unguessable id that arrives
 * by email — and that is the thing to strengthen if this ever matters. (It is
 * currently weaker than it reads: request ids are rendered on the public board,
 * so the withdraw link is not really a secret. Moving withdrawal onto its own
 * emailed token would fix both at once.)
 *
 * What this check *does* still buy, on every row, is that the two account
 * namespaces cannot be crossed: a claimed handle keys as `claimed:<handle>` and
 * a proved account keys off the provider's own id, so no amount of typing gets
 * a claimed proof past a row posted by someone who signed in. See `claimKey`.
 */
export async function requireRequestOwner(event: H3Event, request: BookRequest) {
  if (request.requesters.length === 0) return

  const held = await requireIdentities(event, 'changing your request')

  // Any account in common is enough. A reader who attached three profiles and
  // comes back holding one of them is the person who posted it, and asking them
  // to re-attach all three to fix a typo would be a toll rather than a check.
  if (!sharesAccount(held, request.requesters)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'This request was posted from a different account.'
    })
  }
}
