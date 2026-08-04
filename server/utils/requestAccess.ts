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
 * This is now worth what it always read as being worth. While a request could be
 * posted under an account that was merely named or claimed, the check below was
 * a speed bump on those rows rather than authorisation: the handle is printed on
 * the board, so anyone could go and get a matching proof for it — or, on a
 * claimed row, simply type the same handle back in. With only signed-in accounts
 * issuable, and `readProofs` refusing anything else, matching a fresh proof
 * against the row means the person in front of us holds an account the poster
 * held.
 *
 * Rows posted under the old rungs mostly still work, and it is worth knowing
 * why: a named GitHub, GitLab or Bluesky account was stored under the
 * provider's own id — the numeric id, or the DID — which is the same id the
 * sign-in route records. So the reader who named one of those can sign into it
 * today and be recognised as the poster. That was designed for on the way in and
 * it pays off on the way out.
 *
 * Two kinds of row cannot be matched by anyone any more: a *claimed* handle,
 * which was keyed `claimed:<handle>` in a namespace nothing can produce a proof
 * in, and a Mastodon account, which has no sign-in route to come back through.
 * On those the emailed link is the whole capability, exactly as it is for rows
 * posted before any of this existed. (That link is weaker than it reads —
 * request ids are rendered on the public board, so it is not really a secret.
 * Moving withdrawal onto its own emailed token is the fix, and it is the thing
 * to do if a reader ever cannot take down a request they posted.)
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
