// Shape of the sealed cookie (nuxt-auth-utils).
//
// The library is used only for the OAuth round trip and the sealed cookie; the
// account model it offers is not. Nothing is stored under `user`, because there
// is no user — a completed challenge leaves a proof, and the proofs a reader has
// gathered are the accounts they are attaching to their request.
// `useUserSession().loggedIn` is therefore always false by design; read them
// through `useIdentityProof()` instead.
//
// This lives under `shared/` rather than the project root because that is the
// one directory whose `.d.ts` files both the app and the Nitro server tsconfigs
// pull in; a root-level augmentation would be invisible to the server.
import type { IdentityProof } from './identity'

declare module '#auth-utils' {
  interface UserSession {
    /** Every account attached so far, in the order they were attached. */
    proofs?: IdentityProof[]
  }
}

export {}
