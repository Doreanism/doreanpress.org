// Prove you hold a Twitch account. Callback URL to register: <site>/verify/twitch
//
// Like X, Twitch hands us a public handle, so the board can link straight at a
// channel a sponsor can go and look at — which is the whole point of showing an
// account at all.

interface TwitchUser {
  id?: string
  login?: string
  display_name?: string
  profile_image_url?: string
  created_at?: string
  email?: string
  broadcaster_type?: string
}

const handler = defineOAuthTwitchEventHandler({
  // Email only, and only to prefill the reader's own contact field. Nothing
  // here reads or writes a channel.
  config: { scope: ['user:read:email'] },

  async onSuccess(event, { user }: { user?: TwitchUser }) {
    if (!user?.id || !user.login) {
      return challengeFailed(event, 'twitch', new Error('Twitch returned no profile'))
    }

    return completeChallenge(event, {
      provider: 'twitch',
      subject: String(user.id),
      name: user.display_name || user.login,
      handle: user.login,
      profileUrl: `https://twitch.tv/${encodeURIComponent(user.login)}`,
      avatarUrl: user.profile_image_url,
      accountCreatedAt: user.created_at
      // `broadcaster_type` is deliberately not mapped to `providerVerified`.
      // Partners do carry a badge, but it is a monetisation tier — reading it
      // as "Twitch verified this person" would be exactly the overclaim the
      // rest of this codebase is written to avoid.
    }, user.email)
  },

  onError: (event, error) => challengeFailed(event, 'twitch', error)
})

export default defineEventHandler((event) => {
  if (!getQuery(event).code) rememberReturnTo(event)
  return handler(event)
})
