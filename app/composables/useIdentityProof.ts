/**
 * The public accounts attached to the request being written, if any.
 *
 * Read this rather than `useUserSession().loggedIn` — nothing is stored under
 * `user`, so that flag is always false by design. Proofs last the twenty minutes
 * of their cookie and cover everything the reader does in that window; actions
 * leave them alone. `refresh()` matters after anything that ends one —
 * detaching an account, or a lapse a request surfaced as a 401.
 *
 * There is no sign-out counterpart on purpose. A proof is not a login: there is
 * no account to be in, and detaching one is editing the request rather than
 * leaving.
 */
export function useIdentityProof() {
  const { session, fetch: refresh } = useUserSession()

  const proofs = computed(() => session.value?.proofs ?? [])

  return {
    proofs,
    /** The accounts attached. Safe to show — they are public by design. */
    identities: computed(() => proofs.value.map(p => p.identity)),
    /**
     * The address a provider handed us, for prefilling the reader's own form.
     * The first that offered one, since most providers offer none.
     */
    email: computed(() => proofs.value.find(p => p.email)?.email),
    /** Whether anything at all is attached — what the submit button waits on. */
    verified: computed(() => proofs.value.length > 0),
    refresh
  }
}
