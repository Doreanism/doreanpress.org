// Shape of the sealed cookie (nuxt-auth-utils).
//
// The library supplies the OAuth round trip and sealed cookie. Provider profile
// data lives in Postgres; the cookie carries only an opaque account id and a
// compact sign-in summary.
//
// This lives under `shared/` rather than the project root because that is the
// one directory whose `.d.ts` files both the app and the Nitro server tsconfigs
// pull in; a root-level augmentation would be invisible to the server.
import type { SignedIn } from './account'

declare module '#auth-utils' {
  interface UserSession {
    /** Opaque database account id; provider profile data never enters the cookie. */
    accountId?: string
    signedIn?: SignedIn
  }
}

export {}
