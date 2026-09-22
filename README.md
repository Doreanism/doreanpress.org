# doreanpress.org

The website for **Dorean Press** — a publishing ministry built on the conviction
that the gospel is freely given (Matthew 10:8, *“freely you have received; freely
give”*). Print and Kindle editions are sold through Amazon; gifts for readers
who cannot pay go through Zeffy.

Built with **Nuxt 4**, **Nuxt UI**, and Neon Postgres.

## Features

- **Catalog** of titles (`shared/catalog.ts` is the single source of truth for
  book data, shared by the UI and the server), each linking to its Amazon listing.
- **Give a Book (pay-it-forward)** — a reader who can't pay submits a request;
  another visitor gives toward it through Zeffy; the press orders and ships it
  to the requester, then marks the request fulfilled.
- **About** page and a hand-drawn SVG logo.

## Setup

```bash
npm install
cp .env.example .env   # email goes to Mailpit; requests work with no keys
npm run dev            # http://localhost:3000
```

`npm run dev` first starts the local Postgres, Neon HTTP proxy, and Mailpit
services through Docker Compose and waits for startup before launching Nuxt.
Docker must be running. Mailpit's inbox is at http://localhost:8025.
The services stay running when Nuxt stops; use `npm run dev:services:stop`
to stop them while keeping database data. To start just the services, use
`npm run dev:services`.

> Note: port 3000 may be in use by another local app — `PORT=3100 npm run dev`
> to pick another.

## Environment

See `.env.example`. With no keys, email is logged or caught by Mailpit and
donations stay disabled. To go live, set the `NUXT_*` variables.

Readers sign in or create an account at `/account` using an emailed sign-in
link (ten-minute expiry, single use). Email verification is
required before attaching social profiles or requesting books. A request still
requires at least one public profile; its private contact email comes from the
signed-in account. Social OAuth links profiles and does not sign into another
reader account. A profile already linked elsewhere cannot be moved this way.

Accounts and login challenges persist in Postgres. Link sends are limited to
five per inbox per fifteen minutes, including resends and successful logins.
Configure `NUXT_SMTP_URL` or `NUXT_BREVO_API_KEY` for delivery; locally, use
Mailpit or the mock-email console output. Delivery errors are reported to the
sign-in form. Localhost links preserve the running port; open them on the
development machine. The development-only Mailpit button in the lower-right
corner opens the local inbox at `http://localhost:8025`; its chip shows the inbox’s
unread count and refreshes every ten seconds or when you return to the tab. Opening a link signs the reader in automatically and returns them to their
original page. Plain HTTP GET requests do not consume links; scanners that run
JavaScript may still use a link, in which case the reader can request a new one. Existing email
accounts continue working; legacy provider-only sessions must verify an inbox
before proceeding.

The `/profiles` page manages both verified emails and social profiles. Additional
emails are added only after a single-use link is opened in the requesting
browser. Any verified email can sign into the same account. The primary email
receives shipping and account notifications; choose another verified primary
before removing it, and keep at least one email. An address already owned by a
different account cannot be added. Requests, gifts, and queued notifications
are bound to the account so primary changes and removals preserve history.

| Variable | Purpose |
| --- | --- |
| `NUXT_PUBLIC_SITE_URL` | Canonical production URL (sign-in links, OG images) |
| `NUXT_SESSION_PASSWORD` | Seals the identity-proof cookie (32+ chars) |
| `NUXT_OAUTH_GITHUB_CLIENT_ID` / `..._SECRET` | Sign in with GitHub (also X, Facebook, LinkedIn, Twitch); optional |
| `NUXT_OAUTH_TIKTOK_CLIENT_KEY` / `..._SECRET` | Sign in with TikTok — a *key*, not an id; optional |
| `NUXT_BREVO_API_KEY` / `NUXT_SMTP_URL` | Email delivery (Brevo in production, Mailpit locally) |
| `NUXT_ZEFFY_*` | Donation campaign and signed webhook; see the migration runbook |
| `NUXT_EASYPOST_*` | Carrier tracking updates; optional |
| `NUXT_MAINTENANCE_SECRET` | Bearer token for the daily `/api/ministry-maintenance` job |

## Architecture

```
shared/catalog.ts              Authoritative book data
app/pages/                     Home, catalog, book detail, give, orders, admin
app/components/                AppLogo, BookCard, RequestFreeModal
server/utils/requests.ts       Pay-it-forward datastore (Neon Postgres)
server/utils/zeffy.ts          Zeffy webhook verification and gift allocation
server/utils/tracking.ts       EasyPost carrier tracking
server/routes/verify/*         Sign-in challenge: prove an account you can log into
server/api/requests/*          Create / list / sponsor book requests
server/api/zeffy/webhook.post  Record completed gifts
server/api/easypost/webhook.post Delivery status updates
```

To replace the file-backed datastore with a real database, swap the Nitro
`storage` driver in `nuxt.config.ts` — the `server/utils/requests.ts` interface
stays the same.

## To do before launch

- Replace the sample catalog entries + covers.
- Configure Zeffy, Brevo, and (optionally) EasyPost in production and register
  their webhooks (Zeffy → `/api/zeffy/webhook`, EasyPost → `/api/easypost/webhook`).

## Amazon / Zeffy migration

New print purchases now link to Amazon. New donations use a signed Zeffy
webhook and expiring recommendation codes. The protected fulfillment queue at
`/admin/fulfillment` includes order visibility controls, manual KDP ordering,
copyable agent tasks, and private carrier tracking.

See [the migration runbook](docs/ministry-migration.md) for campaign setup,
administrator provisioning, environment variables, scheduled reconciliation,
and the production cutover checklist. Live donations remain disabled until
Zeffy is configured.

Run isolated Postgres integration tests against the local Neon proxy with:

```sh
MINISTRY_DB_TEST=1 node --env-file=.env node_modules/vitest/vitest.mjs run test/ministry-db.test.ts
```

Each run creates and drops its own test schema; it does not clear application
records. Ordinary `npm test` runs the unit suite and skips these database tests.
