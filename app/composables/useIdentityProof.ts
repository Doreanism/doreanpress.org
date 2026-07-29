/**
 * The identity proof currently held, if any.
 *
 * Read this rather than `useUserSession().loggedIn` — nothing is stored under
 * `user`, so that flag is always false by design. A proof exists only between
 * completing a challenge and finishing the action it was raised for; the server
 * spends it as soon as that action lands, which is why `refresh()` matters after
 * anything that consumes one.
 *
 * There is no sign-out counterpart on purpose. A proof is not a login, so the
 * only way to be rid of one is to use it or let it lapse.
 */
export function useIdentityProof() {
  const { session, fetch: refresh } = useUserSession()

  const proof = computed(() => session.value?.proof ?? null)

  return {
    proof,
    /** The account proved, or null. Safe to show — it is public by design. */
    identity: computed(() => proof.value?.identity ?? null),
    /** Whether a usable proof is in hand right now. */
    verified: computed(() => Boolean(proof.value)),
    refresh
  }
}
