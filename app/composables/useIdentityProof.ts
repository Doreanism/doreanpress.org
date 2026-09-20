import type { RequesterIdentity } from '#shared/identity'

interface AttachedAccountState {
  identities: RequesterIdentity[]
  email?: string
  verified: boolean
}

/**
 * Public provider accounts saved against the current durable reader account.
 *
 * No `default`. Nuxt reads any defined `data` during hydration as the payload
 * the server sent and skips the fetch — and the request modal mounts mid
 * hydration, on the `/cart?request=1` every provider returns to. With a default
 * the reader came back from signing in to a modal that showed no account
 * attached and no way to post, while `/api/verify/accounts` held it all along.
 */
export function useIdentityProof() {
  const { data, refresh } = useFetch<AttachedAccountState>('/api/verify/accounts', {
    key: 'attached-accounts'
  })

  const identities = computed(() => data.value?.identities ?? [])

  return {
    proofs: computed(() => identities.value.map(identity => ({
      id: `${identity.provider}:${identity.subject}`,
      identity,
      email: data.value?.email
    }))),
    identities,
    email: computed(() => data.value?.email),
    verified: computed(() => data.value?.verified ?? false),
    refresh
  }
}
