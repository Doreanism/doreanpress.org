// Prove you hold a GitHub account. Callback URL to register: <site>/verify/github
//
// The one provider a reader can reach either way, and the two routes agree on
// what an account *is*: `subject` is the numeric id here and in
// `lookupGithub`, so an account named before this was configured is the same
// account once its holder signs in. That is what lets the real holder of a
// named account take over — or take down — a request posted under their handle.
//
// Where these credentials are set, naming a GitHub account stops being offered
// at all: see `offeredLookupProviders`.

interface GitHubUser {
  id?: number
  login?: string
  name?: string
  avatar_url?: string
  html_url?: string
  created_at?: string
  email?: string | null
}

const handler = defineOAuthGitHubEventHandler({
  // `read:user` and nothing else. `emailRequired` would add `user:email` and
  // then fail the whole challenge for anyone without a verified primary
  // address — a steep price for prefilling one form field, so the public email
  // is taken if it is there and missed if it is not.
  config: { scope: ['read:user'] },

  async onSuccess(event, { user }: { user?: GitHubUser }) {
    if (!user?.id || !user.login) {
      return challengeFailed(event, 'github', new Error('GitHub returned no profile'))
    }

    return completeChallenge(event, {
      provider: 'github',
      subject: String(user.id),
      name: user.name || user.login,
      handle: user.login,
      // Encoded even though GitHub restricts logins to letters, digits and
      // hyphens — this URL is rendered as a link on a public page.
      profileUrl: user.html_url || `https://github.com/${encodeURIComponent(user.login)}`,
      avatarUrl: user.avatar_url,
      accountCreatedAt: user.created_at
    }, user.email || undefined)
  },

  onError: (event, error) => challengeFailed(event, 'github', error)
})

export default defineEventHandler((event) => {
  if (!getQuery(event).code) rememberReturnTo(event)
  return handler(event)
})
