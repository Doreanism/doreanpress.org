// Who is signed in, shared across the app.
//
// One piece of state, fetched once, so the header and the orders page cannot
// disagree about whether there is anybody there. `useState` rather than a
// module-level ref: the server renders for one reader at a time and a shared
// module ref would leak one reader's address into another's page.

import type { SignedIn } from '#shared/account'

export function useSignedIn() {
  const signedIn = useState<SignedIn | null>('signed-in', () => null)
  const pending = useState('signed-in-pending', () => false)
  // Whether `signedIn` has been asked yet, as distinct from asked and empty.
  // False only in a prerendered page's HTML — there is no reader at build time
  // — until the client asks; the header draws neither shape until then.
  const known = useState('signed-in-known', () => false)

  // `useRequestFetch`, not bare `$fetch`. On the server a plain `$fetch` to our
  // own API sends no cookies — it is a fresh call, not a continuation of the
  // reader's request — so `/api/auth/me` answers "nobody", and the header
  // renders "Sign in" to somebody who is signed in until the client corrects it.
  // This forwards the incoming request's headers, so SSR sees who is actually
  // there. Client-side it is ordinary `$fetch`.
  const request = useRequestFetch()

  async function refresh() {
    const res = await request<{ signedIn: SignedIn | null }>('/api/auth/me')
    signedIn.value = res.signedIn
    known.value = true
    return signedIn.value
  }

  /** Ask for a sign-in link. Answers the same whether or not the address is known. */
  async function requestLink(email: string, redirect: string) {
    pending.value = true
    try {
      await $fetch('/api/auth/request-link', { method: 'POST', body: { email, redirect } })
    } finally {
      pending.value = false
    }
  }

  async function confirmLink(token: string) {
    pending.value = true
    try {
      const res = await $fetch<{ signedIn: SignedIn, redirect: string }>('/api/auth/confirm-link', {
        method: 'POST',
        body: { token }
      })
      signedIn.value = res.signedIn
      known.value = true
      await refreshNuxtData('attached-accounts')
      return res
    } finally {
      pending.value = false
    }
  }

  async function signOut() {
    await $fetch('/api/auth/signout', { method: 'POST' })
    signedIn.value = null
    await refreshNuxtData('attached-accounts')
  }

  return { signedIn, known, pending, refresh, requestLink, confirmLink, signOut }
}
