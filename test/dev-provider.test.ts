// YouFace is a stand-in that mints a `control` proof without anyone signing into
// anything. That is fine on a laptop and would be a way to help yourself to free
// books anywhere else, so what these tests care about is the fence, not the
// feature.
//
// Note where they run: vitest is not a dev server, so `import.meta.dev` is falsy
// here — which means `configuredProviders` is being exercised along the very
// branch a deployed site takes.
import { describe, expect, it, vi } from 'vitest'
import {
  CHALLENGE_PROVIDERS,
  DEV_ONLY_PROVIDERS,
  IDENTITY_PROVIDERS,
  isDevOnlyProvider,
  providerIcon,
  providerLabel
} from '../shared/identity'

vi.stubGlobal('useRuntimeConfig', () => ({
  // Every real provider fully configured, so anything missing from the offered
  // list is missing because it was filtered, not because it was unconfigured.
  oauth: Object.fromEntries(
    CHALLENGE_PROVIDERS.map(p => [p, { clientId: 'id', clientKey: 'id', clientSecret: 'secret' }])
  )
}))

const { configuredProviders } = await import('../server/utils/oauth')

describe('the dev-only stand-in', () => {
  it('is not offered outside dev, even fully configured', () => {
    expect(import.meta.dev).toBeFalsy()
    const offered = configuredProviders()
    expect(offered).not.toContain('youface')
    for (const provider of DEV_ONLY_PROVIDERS) {
      expect(offered).not.toContain(provider)
    }
  })

  it('does not filter out the real providers along with it', () => {
    const offered = configuredProviders()
    for (const provider of CHALLENGE_PROVIDERS) {
      if (isDevOnlyProvider(provider)) continue
      expect(offered).toContain(provider)
    }
  })

  it('names youface, and only youface, as dev-only', () => {
    expect([...DEV_ONLY_PROVIDERS]).toEqual(['youface'])
    expect(isDevOnlyProvider('youface')).toBe(true)
    expect(isDevOnlyProvider('facebook')).toBe(false)
    expect(isDevOnlyProvider('')).toBe(false)
  })

  it('still describes an account posted under it, so the board never breaks', () => {
    // Rows survive the provider being hidden — a request attached in dev and
    // then viewed against a production build must still render a label and icon.
    expect(providerLabel('youface')).toBe('YouFace')
    expect(providerIcon('youface')).toBe('i-lucide-venetian-mask')
    expect(IDENTITY_PROVIDERS.youface.linkable).toBe(false)
  })

  it('is offered last, so it never displaces a real provider', () => {
    expect(CHALLENGE_PROVIDERS[CHALLENGE_PROVIDERS.length - 1]).toBe('youface')
  })
})
