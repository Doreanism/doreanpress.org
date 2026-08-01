// Confirm an account the reader has named, and let them post if it is there.
//
// The reader gives a provider and an account; we read that account's public
// profile at that provider and, if it exists, issue a proof. That proof carries
// `confirmation: 'existence'`, which is a materially weaker thing than the
// challenge routes produce and is treated as such everywhere downstream — most
// visibly on the board, and in the doorstep rule in `POST /api/requests`.
//
// This is a POST, not a GET, because it has an effect: a successful lookup
// replaces whatever proof the reader was holding.

import { isLookupProvider, lookupAccount } from '../../utils/accountLookup'
import { providerLabel } from '#shared/identity'

interface Body {
  provider?: string
  account?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const provider = String(body?.provider ?? '')
  const account = String(body?.account ?? '').slice(0, 300)

  if (!isLookupProvider(provider)) {
    throw createError({ statusCode: 400, statusMessage: 'That is not a provider we can look an account up on.' })
  }
  if (!account.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Please type your account first.' })
  }

  const label = providerLabel(provider)
  const outcome = await lookupAccount(provider, account)

  if (outcome.status === 'missing') {
    throw createError({
      statusCode: 404,
      statusMessage: `We couldn't find that account on ${label}. Please check the spelling — or paste the link to your profile.`
    })
  }

  // A provider being down is not evidence about the reader's account, and must
  // never be reported to them as though it were. Logged in full, kept vague to
  // the browser: the reason quotes third-party URLs.
  if (outcome.status !== 'found') {
    console.error(`[lookup] ${provider} lookup failed:`, outcome.status === 'unknown' ? outcome.reason : outcome.status)
    throw createError({
      statusCode: 502,
      statusMessage: `We couldn't reach ${label} just now, so we can't confirm the account. Please try again in a minute.`
    })
  }

  // No email: a public profile does not carry one, so unlike a challenge there
  // is nothing here to prefill the reader's own contact details with.
  await issueProof(event, outcome.identity)

  console.info(`[lookup] ${provider} account ${outcome.identity.handle ?? outcome.identity.subject} found and named on a proof (existence only).`)

  return { identity: { ...outcome.identity, verifiedAt: new Date().toISOString() } }
})
