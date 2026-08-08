// Books somebody bought for themselves.
//
// Until this existed a catalog purchase was written down nowhere. Stripe knew
// it had taken the money and Lulu knew it had been asked to print something, but
// this site kept no record at all, so there was nothing to show a buyer asking
// where their book was — and nothing to reconcile against if either of those two
// disagreed with the other.
//
// Kept apart from `book_requests` on purpose. That table is the pay-it-forward
// board: a reader asking, a giver paying, a public message and a badge. A
// purchase has none of that — one person, their own money, their own address —
// and folding the two together would mean every query on the board carrying a
// "…and not actually a purchase" clause forever.

import type { RequestItem } from '#shared/catalog'

export interface Order {
  id: string
  stripeSessionId: string
  /** Buyer's address, from Stripe. The key the orders page is found by. */
  email: string
  /** Buyer's name, from Stripe, so a shipping email can greet them by it. */
  name: string
  items: RequestItem[]
  amountCents: number
  currency: string
  luluJobId?: string | number
  shippingStatus?: string
  trackingUrl?: string
  createdAt: string
}

let schema: Promise<void> | null = null
function ensureSchema() {
  if (!schema) {
    schema = (async () => {
      const sql = db()
      await sql`
        CREATE TABLE IF NOT EXISTS orders (
          id                text PRIMARY KEY,
          stripe_session_id text NOT NULL UNIQUE,
          email             text NOT NULL,
          name              text NOT NULL DEFAULT '',
          items             jsonb NOT NULL DEFAULT '[]'::jsonb,
          amount_cents      integer NOT NULL DEFAULT 0,
          currency          text NOT NULL DEFAULT 'usd',
          lulu_job_id       text,
          shipping_status   text,
          tracking_url      text,
          created_at        text NOT NULL
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS orders_email_idx ON orders (email)`
      // The board is now looked up by who asked and by who paid, neither of
      // which was ever a lookup key before.
      await sql`CREATE INDEX IF NOT EXISTS book_requests_email_idx ON book_requests (email)`
      await sql`CREATE INDEX IF NOT EXISTS book_requests_sponsor_email_idx ON book_requests (sponsor_email)`
    })().then(() => undefined)
  }
  return schema
}

function toOrder(r: Record<string, unknown>): Order {
  return {
    id: r.id as string,
    stripeSessionId: r.stripe_session_id as string,
    email: (r.email as string) ?? '',
    name: (r.name as string) ?? '',
    items: (r.items as RequestItem[]) ?? [],
    amountCents: Number(r.amount_cents ?? 0),
    currency: (r.currency as string) ?? 'usd',
    luluJobId: (r.lulu_job_id as string) ?? undefined,
    shippingStatus: (r.shipping_status as string) ?? undefined,
    trackingUrl: (r.tracking_url as string) ?? undefined,
    createdAt: r.created_at as string
  }
}

/**
 * Record a purchase.
 *
 * `ON CONFLICT DO NOTHING` on the session id is the second line of defence, not
 * the first: `claimEvent` already keeps a retried Stripe delivery from getting
 * this far. It is here because the cost of being wrong is a duplicate row on a
 * page a buyer reads, and the constraint costs nothing.
 */
export async function recordOrder(input: {
  stripeSessionId: string
  email: string
  name?: string
  items: RequestItem[]
  amountCents: number
  currency?: string
  luluJobId?: string | number
}): Promise<void> {
  await ensureSchema()
  await db()`
    INSERT INTO orders (
      id, stripe_session_id, email, name, items, amount_cents, currency, lulu_job_id, created_at
    ) VALUES (
      ${crypto.randomUUID()},
      ${input.stripeSessionId},
      ${normalizeEmail(input.email)},
      ${input.name || ''},
      ${JSON.stringify(input.items)}::jsonb,
      ${Math.max(0, Math.round(input.amountCents))},
      ${input.currency || 'usd'},
      ${input.luluJobId != null ? String(input.luluJobId) : null},
      ${new Date().toISOString()}
    )
    ON CONFLICT (stripe_session_id) DO NOTHING
  `
}

/** Purchases made from this address, newest first. */
export async function listOrdersForEmail(email: string): Promise<Order[]> {
  await ensureSchema()
  const rows = await db()`
    SELECT * FROM orders WHERE email = ${normalizeEmail(email)} ORDER BY created_at DESC
  `
  return rows.map(r => toOrder(r as Record<string, unknown>))
}

/** The purchase a Lulu print job belongs to, for status and tracking updates. */
export async function findOrderByLuluJobId(jobId: string | number): Promise<Order | null> {
  await ensureSchema()
  const rows = await db()`SELECT * FROM orders WHERE lulu_job_id = ${String(jobId)} LIMIT 1`
  const row = rows[0]
  return row ? toOrder(row as Record<string, unknown>) : null
}

export async function updateOrderShipping(
  id: string,
  patch: { shippingStatus?: string, trackingUrl?: string }
): Promise<void> {
  await ensureSchema()
  await db()`
    UPDATE orders
    SET shipping_status = COALESCE(${patch.shippingStatus ?? null}, shipping_status),
        tracking_url    = COALESCE(${patch.trackingUrl ?? null}, tracking_url)
    WHERE id = ${id}
  `
}
