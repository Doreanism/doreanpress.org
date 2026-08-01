// The two ways a reader can put an account behind a request, and which options
// each currently offers.
//
// *Challenge* providers are driven by which ones actually have credentials, so a
// half-configured deployment never shows a button that dead-ends on the
// provider's error page. *Lookup* providers need no credentials at all — they
// are public read-only APIs — so all of them are always on offer.
//
// The split is deliberate in the payload rather than a flag on one flat list:
// the client has to present these as two different promises to the reader, and
// a shape that made it easy to render them as one list would be inviting the
// exact conflation the whole design is trying to avoid.
import { IDENTITY_PROVIDERS, LOOKUP_PROVIDERS } from '#shared/identity'

export default defineEventHandler((event) => {
  return {
    challenge: configuredProviders(event).map(id => ({
      id,
      label: IDENTITY_PROVIDERS[id].label,
      icon: IDENTITY_PROVIDERS[id].icon
    })),
    lookup: LOOKUP_PROVIDERS.map(id => ({
      id,
      label: IDENTITY_PROVIDERS[id].label,
      icon: IDENTITY_PROVIDERS[id].icon,
      accountHint: IDENTITY_PROVIDERS[id].accountHint ?? 'account',
      accountExample: IDENTITY_PROVIDERS[id].accountExample ?? ''
    }))
  }
})
