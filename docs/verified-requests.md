# Verified requests

A reader asking for a free book signs in with a public account first, and that
account is shown on the *Give a Book* board beside their message.

## What this does and doesn't claim

It does not claim the reader is honest or needy. It claims one narrow thing: a
real account, with whatever history it carries, is standing behind the request.
That matters because an account costs something to build and nothing for a
sponsor to inspect — and because the per-account limit below turns "make another
posting" into "make another social account".

Copy on the site is written to stay inside that claim. Please keep it there;
"verified" should never read as "vetted by us".

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
type is the boundary.

## Rules this buys

- **Sign-in required to post.** `POST /api/requests` rejects an anonymous caller.
- **One open request per account.** Enforced on `account_key`; a reader whose
  books have been sponsored is free to ask again.
- **Owner-only edit and withdraw.** `PATCH`/`DELETE` compare the session against
  the account on the request. Rows posted before sign-in existed have no account
  to compare, so for those the unguessable id in the confirmation email stays the
  key — no weaker than the day they were posted, and it doesn't strand anyone.
- **At most `MAX_REQUEST_COPIES` copies per request**, counting every title
  together. Reselling donated books is the obvious abuse left once a request has
  a name on it. Rejected rather than quietly trimmed, and the request modal says
  so before the reader fills in an address.

## Setting up the providers

Each is optional. A provider with no credentials is simply not offered, so you
can ship with one and add the others later. Register the callback URL as
`<site>/auth/<provider>` — e.g. `http://localhost:3000/auth/x`.

- **X** — [developer.x.com](https://developer.x.com): an OAuth 2.0 app, type
  *Confidential client*, scope `users.read`.
- **Facebook** — [developers.facebook.com](https://developers.facebook.com): add
  *Facebook Login*, permissions `public_profile` and `email`. `email` needs app
  review before it works for the public.
- **LinkedIn** — [linkedin.com/developers](https://www.linkedin.com/developers):
  add the *Sign In with LinkedIn using OpenID Connect* product.

Then fill in the `NUXT_OAUTH_*` pairs and `NUXT_SESSION_PASSWORD` (see
`.env.example`). Rotating the session password signs everyone out.

## Developing without any of that

With all six credentials blank, dev builds offer a mock provider at
`/auth/mock?name=Some%20Name`. The account key is derived from the name, so two
names are two people — which is how you exercise the one-request-per-account
rule. `import.meta.dev` is replaced at build time, so the route is inert in a
production bundle.

## Worth doing next

- None of the rules above are covered by automated tests. They were checked by
  hand against the local stack; the unit tests only reach the pure helpers in
  `shared/`. A request-level harness is the obvious gap.
- Avatars are hotlinked from the providers' CDNs and those URLs expire; the badge
  falls back to initials, but caching them would look better over time.
- Nothing rate-limits sign-in itself, so someone with a pile of throwaway
  accounts can still post one request each. The per-account limit raises the
  cost; it doesn't cap the total.
