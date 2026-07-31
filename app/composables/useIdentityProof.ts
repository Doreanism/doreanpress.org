/**
 * The identity proof currently held, if any.
 *
 * Read this rather than `useUserSession().loggedIn` — nothing is stored under
 * `user`, so that flag is always false by design. A proof lasts the twenty
 * minutes of its cookie and covers everything the reader does in that window;
 * actions leave it alone. `refresh()` matters after anything that ends one —
 * discarding it to show a different account, or a lapse a request surfaced as a
 * 401.
 *
 * There is no sign-out counterpart on purpose. A proof is not a login: there is
 * no account to be in, and discarding one is choosing a different account rather
 * than leaving.
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
