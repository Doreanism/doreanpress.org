// Prove you hold a GitLab account. Callback URL to register: <site>/verify/gitlab
//
// GitLab was offered as a lookup before this — name an account and we read its
// public profile — which established that the account was there and nothing
// about who was asking. It federates identity properly, so it moves up rather
// than out: `subject` is the numeric id either way, so a row posted under the
// old route names the same account this one proves.

interface GitLabUser {
  id?: number
  username?: string
  name?: string
  avatar_url?: string
  web_url?: string
  created_at?: string
  email?: string | null
}

const handler = defineOAuthGitLabEventHandler({
  // `read_user` is the smallest scope that returns a profile. GitLab grants
  // `api` by default, which would be a write-capable token for a check that
  // needs to read one page.
  config: { scope: ['read_user'] },

  async onSuccess(event, { user }: { user?: GitLabUser }) {
    if (!user?.id || !user.username) {
      return challengeFailed(event, 'gitlab', new Error('GitLab returned no profile'))
    }

    return completeChallenge(event, {
      provider: 'gitlab',
      subject: String(user.id),
      name: user.name || user.username,
      handle: user.username,
      profileUrl: user.web_url || `https://gitlab.com/${encodeURIComponent(user.username)}`,
      avatarUrl: user.avatar_url,
      accountCreatedAt: user.created_at
    }, user.email || undefined)
  },

  onError: (event, error) => challengeFailed(event, 'gitlab', error)
})

export default defineEventHandler((event) => {
  if (!getQuery(event).code) rememberReturnTo(event)
  return handler(event)
})
