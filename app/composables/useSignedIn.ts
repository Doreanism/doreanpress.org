// Who is signed in, shared across the app.
//
// One piece of state, fetched once, so the header and the orders page cannot
// disagree about whether there is anybody there. `useState` rather than a
// module-level ref: the server renders for one reader at a time and a shared
// module ref would leak one reader's address into another's page.

export interface SignedIn {
  email: string
  at: string
}

export function useSignedIn() {
  const signedIn = useState<SignedIn | null>('signed-in', () => null)
  const pending = useState('signed-in-pending', () => false)

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
    return signedIn.value
  }

  /** Ask for a code. Answers the same whether or not the address is known. */
  async function requestCode(email: string) {
    pending.value = true
    try {
      await $fetch('/api/auth/request-code', { method: 'POST', body: { email } })
    } finally {
      pending.value = false
    }
  }

  async function verifyCode(email: string, code: string) {
    pending.value = true
    try {
      const res = await $fetch<{ signedIn: SignedIn }>('/api/auth/verify-code', {
        method: 'POST',
        body: { email, code }
      })
      signedIn.value = res.signedIn
      return res.signedIn
    } finally {
      pending.value = false
    }
  }

  async function signOut() {
    await $fetch('/api/auth/signout', { method: 'POST' })
    signedIn.value = null
  }

  return { signedIn, pending, refresh, requestCode, verifyCode, signOut }
}
