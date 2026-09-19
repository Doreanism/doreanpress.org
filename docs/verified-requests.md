# Verified requests

Before asking for a free book, a reader puts a public account behind it. That
account is shown on the *Give a Book* board beside their message.

## One check: the reader signs in

There is one way to put an account behind a request. The reader goes to a
provider they hold an account with, signs in there, and the provider tells us who
they are. `Confirmation` in `shared/identity.ts` records that as `control`, and
`control` is the only value anything may write.

| | **Sign in** (challenge) |
|---|---|
| Reader does | Round trip to the provider |
| Provider says | "this is them" |
| Establishes | `control` — the account is theirs |
| Providers | X, Facebook, LinkedIn, GitHub, GitLab, Twitch, TikTok, Bluesky |
| Stops impersonation | Yes |
| Costs an abuser | A new social account per posting |

**A provider earns its place by federating identity.** If it cannot complete an
OAuth round trip that ends with the provider itself naming the account, it is not
offered — however popular it is, and however readable its profiles are.

### What used to be here, and why it went

There were two weaker rungs. A reader could *name* an account for us to fetch
(`existence`: the account is real, and that is all), or simply *tell us* about
one (`claimed`: nothing whatever was checked). Both are gone, along with
`accountLookup.ts`, `accountClaim.ts` and the two endpoints that issued them.

They went because they answered the wrong question. Reading a public profile
establishes that an account exists; a sponsor is not asking whether Jane's
account exists, they are asking whether the person about to receive their money
is Jane. Handles are free to type, so neither rung stopped impersonation, and
neither made a second posting cost anything.

The knock-on was worse than the rungs themselves. Every rule on this site that
leans on an account being *expensive* — the one-order-per-account limit,
ownership of a request, withdrawal — was worth nothing against a handle anybody
could type, so each had to be propped up by a second rule keyed off
`confirmation !== 'control'`: a doorstep check limiting one open order per
address regardless of who posted it. With one rung the props come out. The
doorstep branch is gone from `POST /api/requests`, because `hasControl` is now
true for anything that reaches it.

If a future change is tempted to add a rung back: the test is not "can we check
this cheaply", it is "does this tell a sponsor who they are paying". Being
checkable was never the point.

### Nothing weaker is honoured

`completeChallenge` stamps `control` itself, so no adapter can claim it for
something weaker. Only identities created by those provider callbacks enter the
durable account tables.

### Rows already on the board keep their own verdict

`existence` and `claimed` remain in the `Confirmation` union, and
`confirmationClaim` keeps a branch for each. Deleting them would not delete the
rows that carry them — it would only stop the board describing those rows
honestly, which is the one thing that must not happen. `RequesterBadge` still
draws four states; the request modal no longer does, because only one is
reachable there.

Three of the four retired routes reconcile with sign-in, and by design: a named
GitHub, GitLab or Bluesky account was stored under the provider's own id — the
numeric id, or the DID — which is exactly the id the sign-in route records. The
reader who named one of those can sign into it today and be recognised as the
poster of their old request.

Two kinds of row cannot be matched by anyone: a *claimed* handle, keyed
`claimed:<handle>` in a namespace nothing can produce a proof in, and a Mastodon
account, which has no sign-in route to come back through. On those the emailed
link is the whole capability, as it is for rows posted before any of this
existed. `requireRequestOwner` says the same in more detail.

### Mastodon is kept as metadata only

Mastodon is the one provider dropped rather than promoted. Every Mastodon server
is its own OAuth issuer, so signing in means registering an application with each
instance a reader might be on — there is no single app to configure and so no way
to prove a Mastodon account. Its entry stays in `IDENTITY_PROVIDERS`, marked
`legacy`, so rows posted under it keep their label and icon. A test pins that it
is never offered.

### Bluesky needs a handle first, and it is not a claim

Bluesky is the one provider that cannot be a single button. atproto is a network
of servers, so the handle is what resolves which PDS holds the account and
therefore which server is being asked to sign the reader in.

That field resembles the old lookup field and means something entirely
different: nothing believes what is typed. Type a handle that is not yours and
you arrive at that person's server, needing that person's password. The proof
still comes from the OAuth round trip, and `subject` is the DID — not the handle,
which is a rented DNS name that can move between accounts and would let a
transferred handle inherit the previous holder's requests.

Bluesky also needs no credentials: the client is public, identified by a metadata
document this site serves. It is therefore always offered, and it is why a
deployment with no OAuth applications registered anywhere can still take
requests. Without it, `configuredProviders` returning empty means the site
accepts nothing at all — which is the honest failure, and stated as such on the
form.

## Provider identities are durable sign-ins

Completing a provider round trip creates or refreshes a row in
`reader_identities`, linked to an internal `reader_accounts` row. Authenticating
any identity already in that set recovers the same reader account on a new
browser. Email-code sign-in links an inbox to that account rather than creating a
parallel identity silo.

The sealed cookie carries only the opaque reader-account id and a compact sign-in
label. Full provider profiles live in Postgres, so browser cookie size no longer
sets an arbitrary profile limit. Multiple profiles from the same service are
allowed; `(provider, subject)` is globally unique, preventing the same social
identity from being linked to two reader accounts.

`useIdentityProof()` reads the durable set through `/api/verify/accounts`.
`readProofs` / `requireProofs` / `requireIdentities` retain their historical names
as the authorization boundary for request code, but their source is now the
database rather than a short-lived cookie payload.

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
id — `user.id` on X, Facebook, GitHub and Twitch, `sub` on LinkedIn, `open_id` on
TikTok — before believing anything.
No id, no name: `challengeFailed` logs the reason, sends the reader back with
`?verifyError=<provider>`, and no proof is issued, so the request cannot be
posted. The reader sees a toast (`useChallengeFeedback`); the underlying error
stays in the log, because provider errors carry client ids and internal URLs.

Bluesky reaches the same place by a slightly longer road: the handle the reader
types is resolved to their PDS, and that server runs the sign-in. `user.did` is
the id checked before anything is believed, for the same reason as everywhere
else.

| Provider | Name | Photo | Public link | Age | Provider's own badge |
|---|---|---|---|---|---|
| X | ✓ | ✓ | ✓ `x.com/<handle>` | — | ✓ blue check |
| Facebook | ✓ | ✓ | — | — | — |
| LinkedIn | ✓ | ✓ | — | — | — |
| Twitch | ✓ | ✓ | ✓ `twitch.tv/<login>` | ✓ | — |
| TikTok | ✓ | ✓ | ✓ `tiktok.com/@<username>` | — | ✓ their own |
| GitHub | ✓ | ✓ | ✓ `github.com/<login>` | ✓ | — |
| GitLab | ✓ | ✓ | ✓ `gitlab.com/<username>` | ✓ | — |
| Bluesky | ✓ | ✓ | ✓ `bsky.app/profile/<handle>` | ✓ | — |

X, Twitch, GitHub, GitLab and Bluesky hand us a profile a sponsor can open.
Facebook's `user_link` permission and LinkedIn's vanity name both sit behind
partner review, and Facebook's plain numeric id is app-scoped, so it resolves to
nothing for anybody else. Requests from those two show a verified name and face
with nothing to click.

TikTok's handle and profile link come from the `user.info.profile` scope, which
the route requests alongside `user.info.basic`. TikTok fails the whole
authorisation for a scope the key has not been granted, so a production key only
works once an app review has approved both.

Most providers also give the date the account was opened, and that is carried
(`accountCreatedAt`) and shown. It is worth less than it was — every account on
the board from now on has been proved to be the reader's, so age is no longer
carrying the weight that control could not — but a ten-year-old account still
tells a sponsor something a new one does not, and it costs nothing to pass on.
GitLab returns `created_at` on `read_user`, so it now carries an age it could not
when it was only read publicly.

The board still draws four states and must never collapse them
(`RequesterBadge.vue`). Only the first can be earned now; the rest are history
the board is still obliged to tell truthfully:

- **proved** — a tick, and "Signed in with X — the account is theirs."
- **named** — no tick, and "This GitHub account is real, but we haven't checked
  the person asking is the one who holds it. Open the profile and judge for
  yourself."
- **told** — no tick, no avatar, and "They told us this is their Facebook. We
  haven't checked that it exists or that it's theirs — Facebook gives us no way
  to. Open it and judge for yourself."
- **none** — a legacy row, marked as posted before any of this was required.

Do not simplify this component on the grounds that everything is proved now. Any
row still on the board that was posted under the old rungs would then be drawn as
proved, which is the one lie this whole feature exists to avoid. The request modal
*was* simplified, and that is safe for the opposite reason: it lists only what is
in the cookie, and nothing weaker can get into one.

The gap between **named** and **told** is easy to wave away as a shade of grey
and it is not: one means we fetched a page and the account was there, the other
means somebody typed a name into a box. A sponsor choosing between two cards
deserves to know which they are looking at.

The provider's own verified badge is only ever drawn on a **proved** account.
Rendering somebody else's blue check next to an unproved claim to be them would
be the worst version of this whole feature. A **told** account carries no avatar
either — there is none to fetch, and the badge falls back to initials rather than
borrowing a face.

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

- **At least one attached account is required to post.** `POST /api/requests`
  rejects a caller with none. What is attached survives the posting, so
  correcting or withdrawing needs no second trip to the provider. A request
  stores every attached account (`requesters`), and the board draws every one of
  them with its own verdict — showing only the best-checked would let it vouch
  silently for the rest.
- **One open order per doorstep.** Enforced on the attached accounts plus
  `destinationKey`, and *any* of them matching an open order counts
  (`listOpenRequestsForAccounts`) — otherwise detaching a profile would buy a
  second posting. A reader already on the board who asks for another book is
  not posting a second time: the copies are added to the order waiting at that
  address and the message is kept under the old one, so it stays one card, one
  list and one sponsor button. An order to a *different* address is refused with
  a 409 — that is the papering the challenge exists to make expensive. A reader
  whose books have been sponsored starts again with a clean slate. Rows left over
  from the old one-request-per-account rule are folded on the first write
  (`ensureSchema`); an in-flight checkout still points at the surviving id,
  because the earliest row is the one kept.
- **Only a posting account may edit or withdraw.** `PATCH`/`DELETE` compare what
  is in hand against the accounts stored on the request, and any one in common is
  enough (`sharesAccount`) — a reader who attached three profiles and comes back
  holding one of them is the person who posted it. Rows posted before the
  challenge existed have no account to compare, so for those the unguessable id
  in the confirmation email stays the key — no weaker than the day they were
  posted, and it doesn't strand anyone.

  This check is now worth what it reads as being worth. While an account could be
  merely named, the handle was printed on the board and anyone could go and get a
  matching proof for it, so it was a speed bump rather than authorisation. With
  only signed-in accounts issuable it means what it says. See the note in
  `server/utils/requestAccess.ts` for which old rows can still be matched — most
  can — and which can no longer be matched by anyone.
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

**Bluesky needs no setup and is always offered.** atproto identifies a client by
a metadata document rather than a secret, and `nuxt-auth-utils` serves it from
this site once `auth.atproto` is on (it is, in `nuxt.config.ts`). So a deployment
with no OAuth applications registered anywhere still takes requests — from
readers with a Bluesky account, proved exactly as strongly as any other. That is
what keeps "sign-in only" from meaning "nothing works until you fill in six
forms".

Every other provider is optional and simply not offered without credentials.
Register the callback URL as `<site>/verify/<provider>` — e.g.
`http://localhost:3000/verify/x`.

- **X** — [developer.x.com](https://developer.x.com): an OAuth 2.0 app, type
  *Confidential client*, scope `users.read`.
- **Facebook** — [developers.facebook.com](https://developers.facebook.com): add
  *Facebook Login*, permissions `public_profile` and `email`. `email` needs app
  review before it works for the public.
- **LinkedIn** — [linkedin.com/developers](https://www.linkedin.com/developers):
  add the *Sign In with LinkedIn using OpenID Connect* product. (That is the
  product's own name; what we do with it is still a one-shot challenge.)
- **GitHub** — [github.com/settings/developers](https://github.com/settings/developers):
  a plain OAuth App, no review, scope `read:user`. The cheapest of the lot to
  register, and it gives sponsors a profile to open.
- **GitLab** — [gitlab.com/-/profile/applications](https://gitlab.com/-/profile/applications):
  scope `read_user`, which is the smallest that returns a profile. Do not leave
  the default `api` scope on: it is a write-capable token for a check that reads
  one page.
- **Bluesky** — nothing to register. See above.
- **Twitch** — [dev.twitch.tv/console](https://dev.twitch.tv/console): register an
  application, category *Website Integration*, scope `user:read:email`.
- **TikTok** — [developers.tiktok.com](https://developers.tiktok.com): add *Login
  Kit*. Its credentials are `NUXT_OAUTH_TIKTOK_CLIENT_KEY` and `..._CLIENT_SECRET`
  — a *key*, not an id, which is TikTok's own name for it and what
  `configuredProviders` looks for. Add `user.info.profile` to the app's scopes
  (in a Sandbox, directly; in production, through app review) — the route
  requests it, and TikTok refuses the sign-in for a key that lacks it.

Then fill in the `NUXT_OAUTH_*` pairs and `NUXT_SESSION_PASSWORD` (see
`.env.example`). Rotating the session password signs browsers out; their linked
provider identities remain in the database and any one can authenticate them
again.

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

The lookup and claim routes are gone too, and they were the other way of walking
this flow without credentials. Nothing replaced them, and nothing should: both
let a request onto the board that nobody had proved anything about, which is what
this page exists to prevent.

What you use instead is **Bluesky**, which needs no registration and is a real
round trip — a genuine sign-in at the reader's own PDS, failing in production
exactly as it fails locally. It is not a stand-in for the challenge; it *is* the
challenge, on the one provider that does not ask you to fill in a form first.
Walking the request flow locally means having a Bluesky account, or registering a
GitHub OAuth App, which is the cheapest of the credentialed ones — no review
queue, callback `http://localhost:3000/verify/github`.

## Worth doing next

- **The handler rules have no automated coverage.** They were checked by hand
  against the local stack. Unit tests reach pure functions only — `shared/`, and
  `destinationKey` / `orderKey` / `foldOrders`. What is untested is every rule
  that lives in a handler: proof required to post, one order per doorstep,
  ownership on edit and withdraw, and — now the most load-bearing of them —
  `readProofs` refusing anything that is not `control`. That needs a
  request-level harness. There is no mock provider to mint a proof through, so
  the harness will have to seal a proof cookie directly, which is also the only
  way to test that a pre-existing weaker proof is refused.
- **No route is exercised against the provider it talks to.** A provider
  renaming a field breaks the badge silently, and the traps are real: a
  since-removed Codeberg adapter read an `active` field that Forgejo fills in
  only for admins, which would have reported every real account as missing. A
  contract test run on a schedule rather than in CI is probably the shape of the
  fix. Bluesky is the one that can be exercised without credentials.
- **Request ids are public, and withdrawal leans on them.** The board renders
  every open request's id, and for a legacy row — or one posted under a claimed
  handle or a Mastodon account, neither of which anyone can prove now — that id
  is effectively the whole capability. Moving withdrawal onto its own unguessable
  token, emailed and never rendered, is the fix.
- Avatars are hotlinked from the providers' CDNs and those URLs expire; the badge
  falls back to initials, but caching them would look better over time.
- Nothing rate-limits the challenge. Someone with a pile of real social accounts
  can still post one request each — which is now the actual cost of papering the
  board, and the reason the weaker rungs are gone.
