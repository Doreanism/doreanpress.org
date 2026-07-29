// Prove you hold an X account. Callback URL to register: <site>/verify/x
//
// X is the most useful of the three for a sponsor, because it is the only one
// that hands us a public handle — the board can link straight to the profile,
// and anyone deciding whether to fund a request can see the account's history
// for themselves.

interface XUser {
  id?: string
  name?: string
  username?: string
  profile_image_url?: string
  verified?: boolean
}

const handler = defineOAuthXEventHandler({
  // No `offline.access`: we read the profile once at challenge time and never act on
  // the reader's behalf, so there is nothing to refresh a token for.
  config: { scope: ['users.read', 'tweet.read'] },

  async onSuccess(event, { user }: { user?: XUser }) {
    // The library swallows a failed profile fetch and passes the error through
    // in place of the user, so an id is what tells us the call really worked.
    if (!user?.id || !user.username) {
      return challengeFailed(event, 'x', new Error('X returned no profile'))
    }

    return completeChallenge(event, {
      provider: 'x',
      subject: String(user.id),
      name: user.name || user.username,
      handle: user.username,
      // Encoded even though X restricts handles to word characters — this URL
      // is rendered as a link on a public page, so it doesn't get to be trusted.
      profileUrl: `https://x.com/${encodeURIComponent(user.username)}`,
      // `profile_image_url` is the 48px thumbnail; the full-size variant is the
      // same URL with the size marker swapped.
      avatarUrl: user.profile_image_url?.replace('_normal.', '_400x400.'),
      providerVerified: Boolean(user.verified)
    })
    // X's OAuth 2.0 scopes don't include email, so there's nothing to prefill.
  },

  onError: (event, error) => challengeFailed(event, 'x', error)
})

export default defineEventHandler((event) => {
  if (!getQuery(event).code) rememberReturnTo(event)
  return handler(event)
})
