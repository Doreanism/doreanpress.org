// Prove you hold a TikTok account. Callback URL to register: <site>/verify/tiktok
//
// TikTok gives a display name and photo but, by default, nothing to click: the
// handle and the profile link live behind the `user.info.profile` scope, which
// needs approval in the developer portal. Only `user.info.basic` is requested
// here, because an unapproved scope fails the authorisation outright — a
// provider that works and shows an unlinked account is worth more than one that
// dead-ends for every reader until a review comes back.
//
// The mapping below already reads the handle and link, so adding
// `'user.info.profile'` to the scope once it is granted is the whole change:
// accounts verified after that point start linking, and `linkable` in
// IDENTITY_PROVIDERS can be flipped to match.

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

const handler = defineOAuthTikTokEventHandler({
  config: { scope: ['user.info.basic'] },

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
      profileUrl: user.username
        ? user.profile_deep_link || `https://www.tiktok.com/@${encodeURIComponent(user.username)}`
        : undefined,
      avatarUrl: user.avatar_large_url || user.avatar_url,
      providerVerified: Boolean(user.is_verified)
    })
    // TikTok's Login Kit carries no email scope, so there is nothing to prefill.
  },

  onError: (event, error) => challengeFailed(event, 'tiktok', error)
})

export default defineEventHandler((event) => {
  if (!getQuery(event).code) rememberReturnTo(event)
  return handler(event)
})
