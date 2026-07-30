# Verified requests

Before asking for a free book, a reader proves they hold a public account. That
account is shown on the *Give a Book* board beside their message.

## It's a challenge, not a login

There are no accounts on this site. Completing the round trip to a provider
leaves a short-lived **proof** in a sealed cookie. It lasts twenty minutes and
covers whatever the reader does in that window — post a request, correct it, take
it down — and then lapses. `discardProof` in `server/utils/identityProof.ts` ends
one early, which is what "use a different account" does.

That shape is deliberate:

- Nothing to register, no password, no profile to maintain, nothing to delete.
- No persistent identity in the header, and no sign-out, because there is no
  session to end.
- A stolen or stale cookie is worth little: it acts as one account, for twenty
  minutes, and only on that account's own posting.

It used to be spent the instant its first action landed. That read well in the
abstract and badly in the hand: a reader who posted a request and then wanted it
back down had to go to the provider and return a second time, so every button
took two presses to do one thing. A proof asserts that an account is here, and
the first action does not make that any less true — so it is left alone until it
lapses.

`nuxt-auth-utils` supplies the OAuth dance and the sealed cookie. Its *account*
model is not used: nothing is ever stored under `session.user`, so
`useUserSession().loggedIn` is always false by design. Read the proof through
`useIdentityProof()` on the client and `readProof` / `requireProof` on the server.

## What this does and doesn't claim

It does not claim the reader is honest or needy. It claims one narrow thing: a
real account, with whatever history it carries, is standing behind the request.
That matters because an account costs something to build and nothing for a
sponsor to inspect — and because the per-account limit below turns "make another
posting" into "make another social account".

Copy on the site is written to stay inside that claim. Please keep it there;
"verified" should never read as "vetted by us", and nothing should read as
signing in.

## What a sponsor sees

| Provider | Name | Photo | Public link | Provider's own badge |
|---|---|---|---|---|
| X | ✓ | ✓ | ✓ `x.com/<handle>` | ✓ blue check |
| Facebook | ✓ | ✓ | — | — |
| LinkedIn | ✓ | ✓ | — | — |

Only X hands us a profile a sponsor can open: Facebook's `user_link` permission
and LinkedIn's vanity name both sit behind partner review, and Facebook's plain
numeric id is app-scoped, so it resolves to nothing for anybody else. Requests
from those two show as a verified name and face with nothing to click.

Never public: the shipping address, phone, contact email, or the email the
provider gave us. See `PublicBookRequest` in `server/utils/requests.ts` — that
type is the boundary. The provider's email is held beside the identity rather
than inside it, precisely so it cannot ride along.

## Rules this buys

- **A proof is required to post.** `POST /api/requests` rejects a caller without
  one. The proof survives the posting, so correcting or withdrawing it needs no
  second trip to the provider.
- **One open request per account.** Enforced on `account_key`; a reader whose
  books have been sponsored is free to ask again.
- **Only the posting account may edit or withdraw.** `PATCH`/`DELETE` compare the
  proof in hand against the identity stored on the request. Rows posted before the
  challenge existed have no account to compare, so for those the unguessable id
  in the confirmation email stays the key — no weaker than the day they were
  posted, and it doesn't strand anyone.
- **At most `MAX_REQUEST_COPIES` copies per request**, counting every title
  together. Reselling donated books is the obvious abuse left once a request has
  a name on it. Rejected rather than quietly trimmed, and the request modal says
  so before the reader fills in an address.

Note what the withdraw link in the confirmation email now is: an address, not a
capability. Following it asks for a challenge unless one is already in hand.

On the board itself, a reader holding a proof for the account behind a posting
gets a one-click removal on the card; everyone else follows that link to
`/give/withdraw`, which can raise the challenge the card cannot.

## Setting up the providers

Each is optional. A provider with no credentials is simply not offered, so you
can ship with one and add the others later. Register the callback URL as
`<site>/verify/<provider>` — e.g. `http://localhost:3000/verify/x`.

- **X** — [developer.x.com](https://developer.x.com): an OAuth 2.0 app, type
  *Confidential client*, scope `users.read`.
- **Facebook** — [developers.facebook.com](https://developers.facebook.com): add
  *Facebook Login*, permissions `public_profile` and `email`. `email` needs app
  review before it works for the public.
- **LinkedIn** — [linkedin.com/developers](https://www.linkedin.com/developers):
  add the *Sign In with LinkedIn using OpenID Connect* product. (That is the
  product's own name; what we do with it is still a one-shot challenge.)

Then fill in the `NUXT_OAUTH_*` pairs and `NUXT_SESSION_PASSWORD` (see
`.env.example`). Rotating the session password invalidates proofs in flight,
which at worst means somebody verifies again.

## Developing without any of that

With all six credentials blank, dev builds offer a mock provider at
`/verify/mock?name=Some%20Name`. The account key is derived from the name, so two
names are two people — which is how you exercise the one-request-per-account
rule. `import.meta.dev` is replaced at build time, so the route is inert in a
production bundle.

## Worth doing next

- None of the rules above are covered by automated tests. They were checked by
  hand against the local stack; the unit tests only reach the pure helpers in
  `shared/`. A request-level harness is the obvious gap.
- Avatars are hotlinked from the providers' CDNs and those URLs expire; the badge
  falls back to initials, but caching them would look better over time.
- Nothing rate-limits the challenge itself, so someone with a pile of throwaway
  accounts can still post one request each. The per-account limit raises the
  cost; it doesn't cap the total.
