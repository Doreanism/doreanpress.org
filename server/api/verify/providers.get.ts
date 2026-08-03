// The three ways a reader can put an account behind a request, and which
// options each currently offers.
//
// *Challenge* providers are driven by which ones actually have credentials, so a
// half-configured deployment never shows a button that dead-ends on the
// provider's error page. *Lookup* providers need no credentials at all — they
// are public read-only APIs. *Claim* providers are the ones that can be neither
// signed into here nor read anywhere, so all that is left is the reader's word.
//
// Each provider appears in exactly one of the three, always the strongest
// available for it — see `offeredLookupProviders` and `offeredClaimProviders`.
//
// The split is deliberate in the payload rather than a flag on one flat list.
// The client draws these in a single picker — a reader knows which social media
// they are on, not which of our checks it supports — but which list a provider
// arrived in decides everything that happens once it is chosen: where it sits
// in the order, whether it offers a sign-in link or a field to type into, which
// endpoint that field posts to, and the sentence stating what will and won't
// have been checked. Keeping the three apart here is what makes that
// per-provider rather than a matter of the client remembering.
import { IDENTITY_PROVIDERS } from '#shared/identity'

export default defineEventHandler((event) => {
  return {
    challenge: configuredProviders(event).map(id => ({
      id,
      label: IDENTITY_PROVIDERS[id].label,
      icon: IDENTITY_PROVIDERS[id].icon
    })),
    lookup: offeredLookupProviders(event).map(id => ({
      id,
      label: IDENTITY_PROVIDERS[id].label,
      icon: IDENTITY_PROVIDERS[id].icon,
      accountHint: IDENTITY_PROVIDERS[id].accountHint ?? 'account',
      accountExample: IDENTITY_PROVIDERS[id].accountExample ?? ''
    })),
    claim: offeredClaimProviders(event).map(id => ({
      id,
      label: IDENTITY_PROVIDERS[id].label,
      icon: IDENTITY_PROVIDERS[id].icon,
      accountHint: IDENTITY_PROVIDERS[id].accountHint ?? 'account',
      accountExample: IDENTITY_PROVIDERS[id].accountExample ?? ''
    }))
  }
})
