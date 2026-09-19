import type { RequesterIdentity } from '#shared/identity'

interface AttachedAccountState {
  identities: RequesterIdentity[]
  email?: string
  verified: boolean
}

/** Public provider accounts saved against the current durable reader account. */
export function useIdentityProof() {
  const { data, refresh } = useFetch<AttachedAccountState>('/api/verify/accounts', {
    key: 'attached-accounts',
    default: () => ({ identities: [], verified: false })
  })

  return {
    proofs: computed(() => data.value.identities.map(identity => ({
      id: `${identity.provider}:${identity.subject}`,
      identity,
      email: data.value.email
    }))),
    identities: computed(() => data.value.identities),
    email: computed(() => data.value.email),
    verified: computed(() => data.value.verified),
    refresh
  }
}
