// Who is allowed to change a posting on the Give a Book board.
//
// Before the identity challenge existed, the request's unguessable id was the
// whole capability: whoever held the link from the confirmation email could edit
// or withdraw it. Then the account became the authority and the id was just an
// address — prove the account again, and match that fresh proof against the
// identity stored on the request.
//
// There are now two keys, either of which is enough: that account, or the email
// address the request was posted with, proved by signing in. Both are things
// only the poster should have, and the second closes the hole the note at the
// bottom of this file describes — a reader who posted under a Mastodon account
// or a claimed handle had no way back in at all, because there is no route to
// re-prove those.
//
// Two keys is more surface than one, and worth being clear about: an inbox now
// opens a posting. It does not open the ability to *make* one. That still costs
// a proved public account, because the account is what a stranger deciding
// whether to spend money is shown.

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
  // Either key opens this. The address the request was posted with is checked
  // first because it is the cheaper answer — no round trip to a provider — and
  // because it is the one that still works for a reader who has lost access to
  // the account they posted under, which the paragraph above notes as the case
  // nothing could previously rescue.
  //
  // This is a real widening: an inbox is now as good as the account for changing
  // a posting. It is not as good for *making* one, and must never become so —
  // the account is what a giver is shown, and no email address tells them
  // anything. See `requireIdentities` in the request handler.
  const signedIn = await readSignedIn(event)
  if (signedIn && normalizeEmail(request.email) === signedIn.email) return

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
