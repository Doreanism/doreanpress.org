// Shape of the sealed session cookie (nuxt-auth-utils).
//
// `identity` is the public account snapshotted onto a request. `email` is the
// address the provider gave us, kept deliberately outside `identity` so it can
// never ride along to the public board by accident — it exists only to prefill
// the reader's own form, and the contact address they actually type is what
// gets stored on the request.
//
// This lives under `shared/` rather than the project root because that is the
// one directory whose `.d.ts` files both the app and the Nitro server tsconfigs
// pull in; a root-level augmentation would be invisible to the server.
import type { RequesterIdentity } from './identity'

declare module '#auth-utils' {
  interface User {
    identity: RequesterIdentity
    email?: string
  }
}

export {}
