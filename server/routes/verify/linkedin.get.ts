// Prove you hold a LinkedIn account. Callback URL to register: <site>/verify/linkedin
//
// Uses "Sign In with LinkedIn using OpenID Connect", whose userinfo endpoint
// returns a name, photo and verified email but no vanity URL — the public
// profile link needs partner access — so this account also shows unlinked.

interface LinkedInUser {
  sub?: string
  name?: string
  given_name?: string
  picture?: string
  email?: string
  email_verified?: boolean
}

const handler = defineOAuthLinkedInEventHandler({
  config: { scope: ['openid', 'profile', 'email'] },

  async onSuccess(event, { user }: { user?: LinkedInUser }) {
    const name = user?.name || user?.given_name
    if (!user?.sub || !name) {
      return challengeFailed(event, 'linkedin', new Error('LinkedIn returned no profile'))
    }

    return completeChallenge(event, {
      provider: 'linkedin',
      subject: String(user.sub),
      name,
      avatarUrl: user.picture
    }, user.email)
  },

  onError: (event, error) => challengeFailed(event, 'linkedin', error)
})

export default defineEventHandler((event) => {
  if (!getQuery(event).code) rememberReturnTo(event)
  return handler(event)
})
