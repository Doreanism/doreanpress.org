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
// opens a posting. Making a new request requires both a verified inbox and
// a proved public account, because the account is what a stranger deciding
// whether to spend money is shown.

import type { H3Event } from 'h3'
import { sharesAccount } from '#shared/identity'
import type { BookRequest } from './requests'

/** A verified inbox or a held public identity must match the saved request. */
export async function requireRequestOwner(event: H3Event, request: BookRequest) {
  // Either key opens this. The address the request was posted with is checked
  // first because it is the cheaper answer — no round trip to a provider — and
  // because it is the one that still works for a reader who has lost access to
  // the account they posted under, which the paragraph above notes as the case
  // nothing could previously rescue.
  //
  // New postings require both email sign-in and a public profile. Existing
  // postings retain either recovery method for compatibility.
  const signedIn = await readSignedIn(event)
  if (signedIn?.accountId && request.accountId === signedIn.accountId) return
  if (!request.accountId && signedIn?.email && normalizeEmail(request.email) === signedIn.email) return

  if (request.requesters.length === 0) {
    throw createError({ statusCode: 403, statusMessage: 'Sign in with the email address used for this request.' })
  }

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
