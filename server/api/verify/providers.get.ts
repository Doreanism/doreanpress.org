// Which providers to offer a challenge with. Driven by which ones actually have
// credentials, so a half-configured deployment never shows a button that
// dead-ends on the provider's error page.
import { IDENTITY_PROVIDERS } from '#shared/identity'

export default defineEventHandler((event) => {
  return configuredProviders(event).map(id => ({
    id,
    label: IDENTITY_PROVIDERS[id].label,
    icon: IDENTITY_PROVIDERS[id].icon,
    devOnly: IDENTITY_PROVIDERS[id].devOnly ?? false
  }))
})
