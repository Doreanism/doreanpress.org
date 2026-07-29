// Sign in with Facebook. Callback URL to register: <site>/auth/facebook
//
// Facebook gives us a verified name, photo and email, but no public profile
// link: the `user_link` permission is behind app review, and the plain numeric
// id is app-scoped, so it resolves to nothing for anyone else. The board shows
// this account as a name and face with no link — see IDENTITY_PROVIDERS.

interface FacebookUser {
  id?: string
  name?: string
  email?: string
  picture?: { data?: { url?: string, is_silhouette?: boolean } }
}

const handler = defineOAuthFacebookEventHandler({
  config: {
    scope: ['public_profile', 'email'],
    fields: ['id', 'name', 'email', 'picture.type(large)']
  },

  async onSuccess(event, { user }: { user?: FacebookUser }) {
    if (!user?.id || !user.name) {
      return signInFailed(event, 'facebook', new Error('Facebook returned no profile'))
    }

    // The silhouette is Facebook's "no photo set" placeholder — drop it and let
    // the badge fall back to initials rather than show a grey stranger.
    const picture = user.picture?.data
    const avatarUrl = picture?.is_silhouette ? undefined : picture?.url

    return completeSignIn(event, {
      provider: 'facebook',
      subject: String(user.id),
      name: user.name,
      avatarUrl
    }, user.email)
  },

  onError: (event, error) => signInFailed(event, 'facebook', error)
})

export default defineEventHandler((event) => {
  if (!getQuery(event).code) rememberReturnTo(event)
  return handler(event)
})
