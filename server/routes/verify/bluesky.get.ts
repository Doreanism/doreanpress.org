// Prove you hold a Bluesky account. Callback URL: <site>/verify/bluesky
//
// The odd one out in shape, not in strength. Bluesky is a network of servers
// rather than one, so before a reader can be sent anywhere they have to say
// which handle they are — that is what tells atproto which PDS holds the
// account and therefore who is being asked to sign them in.
//
// That handle field looks exactly like the one the old lookup route had, and it
// must not be confused with it. Nothing here believes a word of what is typed:
// the handle is an address to knock at, and what comes back is a signed OAuth
// session from the reader's own server. Type somebody else's handle and you are
// sent to their server's sign-in page, where you will need their password.
// `completeChallenge` stamps `control` for the same reason it does everywhere
// else — the provider, not the reader, said who this is.
//
// No credentials to register: atproto identifies the client by a metadata
// document this site serves, so Bluesky is the one provider that works on a
// fresh deployment. See `auth.atproto` and `oauth.bluesky` in nuxt.config.

import type { AppBskyActorDefs } from '@atproto/api'

type BlueskyUser = Partial<AppBskyActorDefs.ProfileViewDetailed> & { did?: string }

const handler = defineOAuthBlueskyEventHandler({
  async onSuccess(event, { user }: { user?: BlueskyUser }) {
    // The DID is the account. Everything else is profile decoration that a
    // reader may simply not have set, but without a DID nothing was proved.
    if (!user?.did) {
      return challengeFailed(event, 'bluesky', new Error('Bluesky returned no DID'))
    }

    return completeChallenge(event, {
      provider: 'bluesky',
      // Not the handle: handles on atproto are rented DNS names that can move
      // between accounts, while the DID is permanent. Keying on the handle
      // would mean an account that changed hands inherited the requests posted
      // by whoever held it before.
      subject: user.did,
      name: user.displayName || user.handle || user.did,
      handle: user.handle,
      profileUrl: user.handle
        ? `https://bsky.app/profile/${encodeURIComponent(user.handle)}`
        : `https://bsky.app/profile/${encodeURIComponent(user.did)}`,
      avatarUrl: user.avatar,
      accountCreatedAt: user.createdAt
    })
  },

  onError: (event, error) => challengeFailed(event, 'bluesky', error)
})

export default defineEventHandler((event) => {
  const query = getQuery(event)
  if (!query.code) {
    // The handler answers a missing handle with a 400 the reader would see raw,
    // so it is caught here and sent back as the same toast every other failed
    // challenge produces.
    if (!String(query.handle || '').trim()) {
      return challengeFailed(event, 'bluesky', new Error('No Bluesky handle given'))
    }
    rememberReturnTo(event)
  }
  return handler(event)
})
