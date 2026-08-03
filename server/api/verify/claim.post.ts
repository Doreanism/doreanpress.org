// Take a reader's word for an account, where there is no way to do better.
//
// The weakest of the three routes: no round trip, no fetch, nothing checked
// beyond the shape of the handle. The proof it issues carries
// `confirmation: 'claimed'`, which the board, the modal and the press
// notification all render as "nothing was checked" — see `confirmationClaim`.
//
// Only reachable for a provider this deployment can neither sign into nor look
// up. Configure that provider's credentials and this route stops accepting it
// the same moment the sign-in button appears.

import { claimAccount, isClaimProvider } from '../../utils/accountClaim'
import { providerLabel } from '#shared/identity'

interface Body {
  provider?: string
  account?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event)
  const provider = String(body?.provider ?? '')
  const account = String(body?.account ?? '').slice(0, 300)

  if (!isClaimProvider(provider)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'That is not a provider you can name an account on.'
    })
  }

  // The rung above this one is always better where it is available, and this is
  // the check that enforces it rather than the list the client is drawn from.
  // Without it, a reader could POST past a configured sign-in button and put an
  // unchecked handle on the board for a provider we could have proved.
  if ((configuredProviders(event) as string[]).includes(provider)) {
    throw createError({
      statusCode: 400,
      statusMessage: `You can sign in with ${providerLabel(provider)} here, which proves the account is yours — please use that instead.`
    })
  }

  if (!account.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Please type your account first.' })
  }

  const outcome = claimAccount(provider, account)
  if (outcome.status !== 'ok') {
    throw createError({
      statusCode: 400,
      statusMessage: `That doesn't look like a ${providerLabel(provider)} account. Please check it — or paste the link to your profile.`
    })
  }

  // No email: nobody told us one, and unlike a challenge there is no provider
  // here to have handed one over.
  await issueProof(event, outcome.identity)

  console.info(`[claim] ${provider} account ${outcome.identity.handle} claimed by a reader (nothing checked).`)

  return { identity: { ...outcome.identity, verifiedAt: new Date().toISOString() } }
})
