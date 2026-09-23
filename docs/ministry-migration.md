# Amazon and Zeffy migration

Print purchases go to each book's Amazon listing. Gifts use Zeffy. The gift
endpoint returns 503 until Zeffy is configured.
The production homepage displays the regular book launch content.

## Organization

Dorean Press is a ministry of **Lakewood Village Baptist Church** (the legal
entity, EIN 94-2878622), which does business as **Silicon Valley Reformed Baptist
Church**. Public copy says "Dorean Press" wherever it can. The legal and DBA
names appear only where they must: the terms and privacy pages (which say who is
responsible), Zeffy receipts (legal name), and the Zeffy/Stripe DBA, which must
match the bank account (Silicon Valley Reformed Baptist Church). The card
statement descriptor is "Dorean Press".

## Before production deployment

1. Obtain church approval, set up the Zeffy organization/campaign under the
   church (see Organization above), and verify the bank account and receipt issuer.
2. Add a text checkout question with the exact label `Dorean Press request
   code`. Donors copy a reservation code into it. The API documents `metadata`
   as reserved for future use, so this implementation does not assume arbitrary
   URL metadata or custom checkout sessions. Reservations last three minutes and renew every 45 seconds while the gift page is open. Closing or leaving the gift page sends a release request; the three-minute expiry remains the fallback if the browser cannot send it. Keep the gift page open when paying in a separate Zeffy tab. Expired reservations cannot be renewed; donors must reopen checkout for a new code.
   A browsing hold expiring or being released does not invalidate its payment code:
   delayed notifications still apply while the original request remains eligible.
   Missing, hidden, changed, or closed recommendations allocate gifts
   to the general ministry balance. Each code refers to the whole request, and
   multiple donors may open checkout concurrently. Successful gifts accumulate
   until they reach the saved estimate; only then does the whole request enter
   fulfillment. Each gift records `allocated_cents`; `amount_cents - allocated_cents`
   is its general-fund portion. Duplicate payments do not change the balance.
   Requests with contributions cannot be edited, merged, or withdrawn by readers.
   Requests without a shipping estimate cannot start checkout.
3. For `NUXT_ZEFFY_CAMPAIGN_URL`, prefer the campaign's embed URL (Campaigns →
   ⋯ → Share → More ways to share → Embed → Campaign; the iframe `src`,
   `https://www.zeffy.com/embed/donation-form/…`). `/give` then shows the form
   inline, with only the payment fields and no church branding; a plain campaign
   URL instead links out to Zeffy. Configure `NUXT_ZEFFY_CAMPAIGN_URL`, `NUXT_ZEFFY_CAMPAIGN_ID`, and
   `NUXT_ZEFFY_WEBHOOK_SECRET`. Subscribe to `payment.completed` at
   `https://doreanpress.org/api/zeffy/webhook`. The handler checks the raw-body
   HMAC, a five-minute timestamp tolerance, campaign, successful status, currency,
   and amount; payment and event ids deduplicate allocation and notifications.
   `NUXT_ZEFFY_API_KEY` is reserved for reconciliation tooling, not required by
   the signed webhook. Test the checkout question round trip with a real gift.
4. Back up the production database using the hosting provider's snapshot/export.
   No production database migration or deployment has been performed by this change.
   Schema changes are additive and run on first use. No order tables are dropped.
5. Sign in with the intended administrator account, look up its opaque id in
   `reader_accounts`, then grant the role through an authorized database console:

   ```sql
   INSERT INTO account_roles (account_id, role, granted_by)
   VALUES ('<account-id>', 'fulfillment_admin', '<church-officer>');
   ```

   Open `/admin/fulfillment` after signing in. Revoke access with:

   ```sql
   DELETE FROM account_roles
   WHERE account_id = '<account-id>' AND role = 'fulfillment_admin';
   ```

   Never select an administrator automatically by email domain. The role is
   checked on every request. Private details and fulfillment changes require an active administrator session;
   the screen clears details after five minutes.
   Claims are durable: an officer must review and reassign a stranded claim in
   the database before another administrator places an order.
6. For automatic delivery updates, configure the EasyPost API key and a webhook
   with a signing secret at `/api/easypost/webhook`. Set the same secret as
   `NUXT_EASYPOST_WEBHOOK_SECRET`. Standalone Trackers are billable. Verify a
   real KDP shipment before assuming AmazonShipping supports it. Authenticated
   Amazon order links stay private and never go to requesters. Known carrier
   identifiers produce a recipient-safe link; unsupported links show updates
   unavailable. The tracking URL is never fetched by this application.
7. Schedule `POST /api/ministry-maintenance` with
   `Authorization: Bearer <NUXT_MAINTENANCE_SECRET>` daily for reconciliation,
   and more frequently for email retries. The outbox survives email failures;
   provider delivery cannot promise exactly once if the process dies immediately
   after sending. Terminal trackers are deleted after seven days; event history
   is retained locally for 90 days. Ensure outgoing email is configured.
8. US suggested gifts budget $9.41 for one copy, based on the supplied checkout:
   $4.98 printing, $3.59 shipping, and $0.84 tax. Each additional copy remains a
   provisional $7 including printing, shipping, and tax. International requests
   need a separate estimate. Calibrate these amounts against actual KDP order
   totals as they become available. Admin
   limits/costs are USD cents; non-USD purchases require an approved conversion.
9. Configure and test the two Porkbun email forwards from the plan. This is a
    logged-in control-panel task, not part of the application deployment.

## Operations

Hide/restore changes public visibility independently of payment and fulfillment.
Hidden orders stay in the admin list and requester history. Public endpoints
send `Cache-Control: no-store`; purge previously cached board/API content when
releasing this change. Already downloaded public information cannot be recalled.

Claim an order before purchasing; the admin list shows the claiming administrator’s
email. Open it to view the books, recipient, and shipping address. Record the amount
paid in USD (including shipping and tax) and the private Amazon order link. Saving
those details marks it ordered and claims it if it was unclaimed. The link is only
returned to administrators and is never placed in requester/donor views or emails.
Add the separate tracking URL when it becomes available; that marks fulfillment
complete. Removing tracking returns the order to the ordered queue. Purchase details
can be corrected later without removing tracking. No spending-limit or Amazon order
number fields are required in this workflow.

A reader may detach an identity only while another remains. To remove the last
identity they must withdraw open requests and contact the ministry to delete the
reader account, after records requiring retention have been reviewed. This is a
manual support process, not a public identity-removal bypass.

## Provider references

- [Zeffy OpenAPI and webhook signatures](https://www.zeffy.com/api/docs)
- [EasyPost Trackers](https://docs.easypost.com/docs/trackers)
- [EasyPost webhook authentication](https://docs.easypost.com/docs/webhooks)
- [EasyPost Node signature implementation](https://github.com/EasyPost/easypost-node/blob/master/src/utils/util.ts)
