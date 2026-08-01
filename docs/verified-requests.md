# Verified requests

Before asking for a free book, a reader puts a public account behind it. That
account is shown on the *Give a Book* board beside their message.

## Two checks, and the difference between them

There are two ways to put an account behind a request, and they do not establish
the same thing. Everything else in this document depends on keeping them apart.

| | **Sign in** (challenge) | **Name it** (lookup) |
|---|---|---|
| Reader does | Round trip to the provider | Types a handle in a field |
| Provider says | "this is them" | nothing — we read a public page |
| Establishes | `control` — the account is theirs | `existence` — the account is real |
| Providers | X, Facebook, LinkedIn | GitHub, Bluesky, Mastodon |
| Stops impersonation | Yes | **No** |
| Costs an abuser | A new social account per posting | Nothing — handles are free to type |

`Confirmation` in `shared/identity.ts` is the type carrying this, and it rides on
every `RequesterIdentity` from the moment it is created. Read it before writing
any copy about an account: an `existence` identity has the same shape as a
`control` one, the same name and the same avatar, and only that field separates
"this is Jane" from "Jane's account exists and someone typed it in".

The weaker check is offered because a reader may have no account on the three
providers we can sign them into, and a real profile a sponsor can go and read is
worth more than nothing. It is not offered as an equal. Sign-in is listed first
in the UI, and a named account is labelled as named everywhere it appears.

### Where the lost scarcity is made up

The per-account limit further down assumes an account is *expensive*. That holds
for one that was signed into and collapses for one that was merely named — the
next request can claim any handle at all. So for a named account the limit moves
to the doorstep: **one open order per address, whoever posted it**. That is the
thing a person asking for parcels cannot multiply. See the second check in
`POST /api/requests`; a reader who genuinely shares an address with another
requester can still sign in, which is the honest way past it.

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

## The account is checked where the reader says it is

Picking *Facebook* sends the reader to Facebook and reads their profile from
Facebook's Graph API; picking X reads theirs from X's. Each route under
`server/routes/verify/` talks to that one provider and maps its payload onto a
`RequesterIdentity` — nothing is typed in by the reader and nothing is inferred.

It fails closed. `nuxt-auth-utils` swallows a failed profile fetch and passes the
error through in place of the user, so each route checks for the provider's own
id — `user.id` on X and Facebook, `sub` on LinkedIn — before believing anything.
No id, no name: `challengeFailed` logs the reason, sends the reader back with
`?verifyError=<provider>`, and no proof is issued, so the request cannot be
posted. The reader sees a toast (`useChallengeFeedback`); the underlying error
stays in the log, because provider errors carry client ids and internal URLs.

A named account is fetched the same way, at the provider named and nowhere else
— `server/utils/accountLookup.ts`, one adapter each, reached through
`POST /api/verify/lookup`. Three rules hold across all of them:

- **Only "definitely not there" reads as not found.** GitHub's 404, Bluesky's
  400, Mastodon's 404 mean no such account. A timeout, a 500 or a rate-limit is
  *unknown* and is reported as "we couldn't reach them", never as "you made that
  up". The distinction survives all the way to the reader's screen.
- **The reader's text never lands in a URL unencoded**, no adapter follows a
  redirect off the host it chose, and every call is time-bounded.
- **Mastodon's host comes from the reader**, which makes it the one lookup that
  could be aimed at our own network. `isAllowedMastodonHost` requires a public
  domain and refuses bare hostnames, anything that parses as an IP address, and
  the usual internal suffixes — before any request leaves the process. That
  guard has its own tests in `test/accountLookup.test.ts`.

### Why only those three can be looked up

X, Facebook and LinkedIn are absent from `LOOKUP_PROVIDERS` and cannot be added.
Facebook removed username lookup from the Graph API; LinkedIn has no public
profile API; X's `/2/users/by/username` needs a paid bearer token. What is left
is reading their HTML, which is scraping — against their terms, blocked from
server IPs, and broken by the next markup change. If one of them ever has to be
offered this way it needs credentials and a real client, not a page fetch. A
test pins them out of the list so this cannot be undone by accident.

## What a sponsor sees

| Provider | Name | Photo | Public link | Age | Provider's own badge |
|---|---|---|---|---|---|
| X | ✓ | ✓ | ✓ `x.com/<handle>` | — | ✓ blue check |
| Facebook | ✓ | ✓ | — | — | — |
| LinkedIn | ✓ | ✓ | — | — | — |
| GitHub | ✓ | ✓ | ✓ `github.com/<login>` | ✓ | — |
| Bluesky | ✓ | ✓ | ✓ `bsky.app/profile/<handle>` | ✓ | — |
| Mastodon | ✓ | ✓ | ✓ `<server>/@<user>` | ✓ | — |

Of the sign-in providers only X hands us a profile a sponsor can open:
Facebook's `user_link` permission and LinkedIn's vanity name both sit behind
partner review, and Facebook's plain numeric id is app-scoped, so it resolves to
nothing for anybody else. Requests from those two show a verified name and face
with nothing to click.

All three lookup providers give a public link, which is not a coincidence —
being publicly readable is exactly what makes them lookup-able in the first
place. They also give the date the account was opened, and that is carried
(`accountCreatedAt`) and shown precisely because it matters most where the
evidence is weakest: a named account cannot be shown to be the reader's, but a
ten-year-old one is still a far better thing to put in front of a sponsor than
one opened this morning.

The board draws three states and must never collapse them (`RequesterBadge.vue`):

- **proved** — a tick, and "Signed in with X — the account is theirs."
- **named** — no tick, and "This GitHub account is real, but we haven't checked
  the person asking is the one who holds it. Open the profile and judge for
  yourself."
- **none** — a legacy row, marked as posted before any of this was required.

The provider's own verified badge is only ever drawn on a **proved** account.
Rendering somebody else's blue check next to an unproved claim to be them would
be the worst version of this whole feature.

Never public: the shipping address, phone, contact email, or the email the
provider gave us. See `PublicBookRequest` in `server/utils/requests.ts` — that
type is the boundary. The provider's email is held beside the identity rather
than inside it, precisely so it cannot ride along.

A card is one reader waiting for one parcel, and there is nothing to group on the
board because there is nothing to group: a reader asking again for the same
address has the books added to the order already there (`foldOrders`), so one
person can never be drawn as two cards. That comparison happens server-side and
only there — half its key is the shipping address, which does not cross the
boundary. Rows with no account are never folded together, however alike their
addresses: saying they are one person is exactly the claim the challenge exists
to avoid making for us.

## Rules this buys

- **A proof is required to post.** `POST /api/requests` rejects a caller without
  one. The proof survives the posting, so correcting or withdrawing it needs no
  second trip to the provider.
- **One open order per doorstep.** Enforced on `account_key` plus
  `destinationKey`. A reader already on the board who asks for another book is
  not posting a second time: the copies are added to the order waiting at that
  address and the message is kept under the old one, so it stays one card, one
  list and one sponsor button. An order to a *different* address is refused with
  a 409 — that is the papering the challenge exists to make expensive. A reader
  whose books have been sponsored starts again with a clean slate. Rows left over
  from the old one-request-per-account rule are folded on the first write
  (`ensureSchema`); an in-flight checkout still points at the surviving id,
  because the earliest row is the one kept.
- **One open order per address, for a named account.** The rule above is worth
  what the account behind it cost, and a named one cost nothing. So a request
  from an `existence` identity is also refused if *any* open order is already
  going to that address, whoever posted it
  (`listOpenRequestsAtDestination`). Signing in lifts that restriction, which is
  the honest way for two people who really do share an address.
- **Only the posting account may edit or withdraw.** `PATCH`/`DELETE` compare the
  proof in hand against the identity stored on the request. Rows posted before the
  challenge existed have no account to compare, so for those the unguessable id
  in the confirmation email stays the key — no weaker than the day they were
  posted, and it doesn't strand anyone.

  On a request whose account was *named*, be clear about what this check is
  worth: the handle is printed on the board, so anyone can go and get a matching
  `existence` proof for it. It is a speed bump, not authorisation. It is kept
  because it costs the reader nothing and does stop the idle case, but the real
  protection on those rows is the same one legacy rows have — an unguessable id
  arriving by email. See the note in `server/utils/requestAccess.ts`, and the
  open gap below.
- **No cap on how many copies a request asks for.** A sponsor chooses what they
  cover and can fund part of an order, so a large request takes nothing from
  anyone who did not decide to give it. One open order per doorstep is the limit
  that remains.

Note what the withdraw link in the confirmation email now is: an address, not a
capability. Following it asks for a challenge unless one is already in hand.

On the board itself, a reader holding a proof for the account behind a posting
gets a one-click removal on the card; everyone else follows that link to
`/give/withdraw`, which can raise the challenge the card cannot.

## Setting up the providers

The three lookup providers need no setup at all — they are public read-only APIs
with no key, no app registration and no quota to speak of, so GitHub, Bluesky and
Mastodon work out of the box, in dev and in production alike. Everything below is
about the sign-in providers.

Each of those is optional: one with no credentials is simply not offered, so you
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

## No stand-in, anywhere

There used to be a mock provider in dev builds, and there is not one now. It is
gone on purpose, and it should not come back:

- A challenge that can be satisfied without an account is not a challenge. The
  mock handed out a proof to anyone who asked, which is exactly the thing every
  rule on this page is written to prevent.
- A flow that behaves one way on a developer's machine and another way in
  production is not the flow being tested. Every bug worth catching here — a
  provider returning no profile, a callback URL registered wrong, a scope not
  granted — lives in the round trip the mock replaced.

So exercising the *challenge* locally needs real credentials for at least one
provider. X is the cheapest to register and the only one that gives sponsors a
profile to open, so it is the one to start with; the callback URL for a dev app
is `http://localhost:3000/verify/x`.

The *lookup* path needs none of that and is the one to reach for when you just
want to walk the request flow: name any real GitHub, Bluesky or Mastodon account
and the form unlocks. That is a convenience of it being genuinely public, not a
stand-in — the account really is fetched, and a handle that does not exist is
refused exactly as it would be in production.

## Worth doing next

- **The handler rules have no automated coverage.** They were checked by hand
  against the local stack. Unit tests reach pure functions only — `shared/`, the
  lookup adapters' shape and host checks, and `destinationKey` / `orderKey` /
  `foldOrders`. What is untested is every rule that lives in a handler: proof
  required to post, one order per doorstep, the named-account address rule, and
  ownership on edit and withdraw. That needs a request-level harness, and it is
  the obvious gap. Removing the mock provider made it harder, not easier — a
  test can no longer mint a proof by walking an HTTP route, so the harness will
  have to seal a proof cookie directly.
- **Request ids are public, and withdrawal leans on them.** The board renders
  every open request's id, and for a legacy row or a named account the id is
  effectively the whole capability. Moving withdrawal onto its own unguessable
  token, emailed and never rendered, would fix that and make ownership on named
  accounts mean something at the same time.
- Avatars are hotlinked from the providers' CDNs and those URLs expire; the badge
  falls back to initials, but caching them would look better over time.
- Nothing rate-limits either check. Someone with a pile of throwaway accounts can
  post one request each, and lookups are unmetered outbound calls to third
  parties on an unauthenticated endpoint — worth a per-IP limit before this sees
  real traffic.
