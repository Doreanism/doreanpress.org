// Shape of the sealed cookie (nuxt-auth-utils).
//
// The library is used only for the OAuth round trip and the sealed cookie; the
// account model it offers is not. Nothing is stored under `user`, because there
// is no user — a completed challenge leaves a `proof` that is spent as soon as
// the action it was raised for lands. `useUserSession().loggedIn` is therefore
// always false by design; read the proof through `useIdentityProof()` instead.
//
// This lives under `shared/` rather than the project root because that is the
// one directory whose `.d.ts` files both the app and the Nitro server tsconfigs
// pull in; a root-level augmentation would be invisible to the server.
import type { IdentityProof } from './identity'

declare module '#auth-utils' {
  interface UserSession {
    proof?: IdentityProof
  }
}

export {}
