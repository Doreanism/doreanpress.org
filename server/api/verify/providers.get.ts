// The providers a reader can put behind a request here, which is to say the
// ones this deployment holds credentials for.
//
// One list, because there is one way in. It used to return three — sign in,
// name an account we fetch, or simply tell us — and which list a provider
// arrived in decided what the picker did with it: a link or a field, which
// endpoint that field posted to, and the sentence about what would and wouldn't
// have been checked. With only the round trip left, a provider is either offered
// or it isn't, and every button does the same thing.
//
// An empty list is a real answer and the client draws it as one: no credentials
// configured means no requests can be posted. That is the point rather than a
// gap — see `configuredProviders`.
import { IDENTITY_PROVIDERS } from '#shared/identity'

export default defineEventHandler((event) => {
  return {
    challenge: configuredProviders(event).map(id => ({
      id,
      label: IDENTITY_PROVIDERS[id].label,
      icon: IDENTITY_PROVIDERS[id].icon
    }))
  }
})
