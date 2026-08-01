# doreanpress.org

The website for **Dorean Press** — a publishing ministry built on the conviction
that the gospel is freely given (Matthew 10:8, *“freely you have received; freely
give”*). Books are printed on demand through Lulu and sold at honest cost.

Built with **Nuxt 4**, **Nuxt UI**, **Stripe**, and the **Lulu Print API**.

## Features

- **Catalog** of titles (`shared/catalog.ts` is the single source of truth for
  prices + print specs, shared by the UI and the server).
- **Buy a book** — Stripe Checkout collects payment + shipping address; a webhook
  creates a Lulu print job shipped to the customer.
- **Give a Book (pay-it-forward)** — a reader who can't pay submits a request;
  another visitor sponsors it; we print and ship it to the requester, then mark
  the request fulfilled.
- **About** page and a hand-drawn SVG logo.

## Setup

```bash
npm install
cp .env.example .env   # printing and email mock out; requests work with no keys
npm run dev            # http://localhost:3000
```

> Note: port 3000 may be in use by another local app — `PORT=3100 npm run dev`
> to pick another.

## Environment

See `.env.example`. With no keys, **Lulu runs in mock mode** (no real print
orders) and Stripe is disabled. To go live, set the `NUXT_*` variables.

Free-book requests need a public account behind them, by one of two routes, and
neither has a mock mode. **Naming an account** (GitHub, Bluesky, Mastodon) needs
no credentials at all — public read-only APIs — so the request flow works out of
the box. **Signing in** (X, Facebook, LinkedIn) is the stronger check and needs
real OAuth credentials; X is the cheapest to register. The two are not
equivalent and the site says which one happened — see
[docs/verified-requests.md](docs/verified-requests.md).

| Variable | Purpose |
| --- | --- |
| `NUXT_PUBLIC_SITE_URL` | Base URL (Stripe success/cancel + OG images) |
| `NUXT_SESSION_PASSWORD` | Seals the identity-proof cookie (32+ chars) |
| `NUXT_OAUTH_X_CLIENT_ID` / `..._SECRET` | Sign in with X (also Facebook, LinkedIn); optional |
| `NUXT_STRIPE_SECRET_KEY` | Stripe secret key (test or live) |
| `NUXT_STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NUXT_LULU_MOCK` | `true` to mock Lulu; `false` to call the real API |
| `NUXT_LULU_CLIENT_KEY` / `NUXT_LULU_CLIENT_SECRET` | Lulu OAuth credentials |
| `NUXT_LULU_BASE_URL` | `https://api.sandbox.lulu.com` or `https://api.lulu.com` |
| `NUXT_LULU_CONTACT_EMAIL` | Contact email on print jobs |

### Stripe webhook (local)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the printed `whsec_…` as `NUXT_STRIPE_WEBHOOK_SECRET`. Fulfilment (Lulu print
job creation) happens in `server/api/stripe/webhook.post.ts` on
`checkout.session.completed`.

### Lulu webhook

`server/api/lulu/webhook.post.ts` receives print-job status changes, writes
them back to the sponsored request, and emails the requester a tracking link
when the job hits `SHIPPED`. Deliveries are authenticated via the
`Lulu-HMAC-SHA256` header (HMAC of the body, keyed with the client secret);
verification is skipped when no secret is configured (mock/dev).

Register the subscription once per environment:

```bash
curl -X POST "$NUXT_LULU_BASE_URL/webhooks/" \
  -H "Authorization: Bearer $LULU_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"topics": ["PRINT_JOB_STATUS_CHANGED"], "url": "https://doreanpress.org/api/lulu/webhook"}'
```

## Architecture

```
shared/catalog.ts              Authoritative book data (price + Lulu print spec)
app/pages/                     Home, catalog, book detail, cart, give, checkout/*
app/components/                AppLogo, BookCard, RequestFreeModal
server/utils/stripe.ts         Stripe client
server/utils/lulu.ts           Lulu Print API client (OAuth + mock fallback)
server/utils/requests.ts       Pay-it-forward datastore (Netlify DB / Neon)
server/routes/verify/*         Sign-in challenge: prove an X/Facebook/LinkedIn account
server/utils/accountLookup.ts  Public lookup: find a named GitHub/Bluesky/Mastodon account
server/api/checkout.post.ts    Create Stripe Checkout session (server-priced)
server/api/requests/*          Create / list / sponsor book requests
server/api/stripe/webhook.post Fulfil orders + sponsorships via Lulu
server/api/lulu/webhook.post   Track print-job status; email tracking on SHIPPED
```

To replace the file-backed datastore with a real database, swap the Nitro
`storage` driver in `nuxt.config.ts` — the `server/utils/requests.ts` interface
stays the same.

## To do before launch

- Replace the sample catalog entries + covers, and point each book's
  `interiorPdfUrl` / `coverPdfUrl` / `podPackageId` at real print-ready files.
- Add real Stripe + Lulu credentials and register the production webhooks
  (Stripe → `/api/stripe/webhook`, Lulu → `/api/lulu/webhook`).
