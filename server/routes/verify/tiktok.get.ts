import type { H3Event } from 'h3'

// Prove you hold a TikTok account. Callback URL to register: <site>/verify/tiktok
//
// `user.info.basic` gives a display name and photo; the handle and the profile
// link live behind `user.info.profile`. Both are requested. Every scope asked
// for here must be enabled for the key in use — an app review for production,
// the Sandbox's scope list for a sandbox key — or TikTok fails the whole
// authorisation rather than returning less.

interface TikTokUser {
  open_id?: string
  union_id?: string
  display_name?: string
  username?: string
  avatar_url?: string
  avatar_large_url?: string
  profile_deep_link?: string
  is_verified?: boolean
}

/**
 * Whether this key is a Sandbox one, which decides whether PKCE is sent.
 *
 * `nuxt-auth-utils` calls that switch `sandbox` and defaults it to
 * `import.meta.dev` — the build, not the credentials. Those came apart the
 * moment a Sandbox key ran in a production build for an app review: the
 * authorisation went out without `code_challenge`, TikTok refused the exchange,
 * and the reader came back with nothing attached and nothing said. A Sandbox
 * key announces itself in its prefix, so ask the key.
 */
function isSandboxKey(event: H3Event): boolean {
  const key = (useRuntimeConfig(event).oauth as { tiktok?: { clientKey?: string } })?.tiktok?.clientKey
  return Boolean(key?.startsWith('sba'))
}

const tiktokHandler = (event: H3Event) => defineOAuthTikTokEventHandler({
  config: {
    scope: ['user.info.basic', 'user.info.profile'],
    sandbox: isSandboxKey(event),
    // Always show TikTok's consent page, even to a reader who has authorised us
    // before. Without it TikTok bounces a signed-in browser straight back, which
    // attaches whichever account happens to be signed in — the consent page is
    // where the reader sees which one it is and can switch. The library has no
    // option for extra authorize params; `withQuery` merges this one in.
    authorizationURL: 'https://www.tiktok.com/v2/auth/authorize/?disable_auto_auth=1'
  },

  async onSuccess(event, { user }: { user?: TikTokUser }) {
    const name = user?.display_name || user?.username
    if (!user?.open_id || !name) {
      return challengeFailed(event, 'tiktok', new Error('TikTok returned no profile'))
    }

    return completeChallenge(event, {
      provider: 'tiktok',
      // App-scoped, like Facebook's: stable for us, meaningless to anyone else.
      subject: String(user.open_id),
      name,
      handle: user.username,
      // The handle form, not `profile_deep_link`. TikTok's deep link is a
      // vm.tiktok.com shortener that says nothing about whose profile it is and
      // asks to open the app; a sponsor reading the board is being shown which
      // account they are paying for, so the link should say so on its face.
      profileUrl: user.username
        ? `https://www.tiktok.com/@${encodeURIComponent(user.username)}`
        : user.profile_deep_link,
      avatarUrl: user.avatar_large_url || user.avatar_url,
      providerVerified: Boolean(user.is_verified)
    })
    // TikTok's Login Kit carries no email scope, so there is nothing to prefill.
  },

  onError: (event, error) => challengeFailed(event, 'tiktok', error)
})

export default defineEventHandler((event) => {
  if (!getQuery(event).code) rememberReturnTo(event)
  return tiktokHandler(event)(event)
})
