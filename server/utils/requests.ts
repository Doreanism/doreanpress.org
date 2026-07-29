// Pay-it-forward book requests.
//
// A reader who cannot pay submits a request — an *order* of one or more titles,
// with a public message and private shipping details. A visitor sponsors it,
// either in full or in part; once paid + sent to Lulu the sponsored books are
// marked fulfilled and drop off the public board, while anything still unfunded
// stays there for the next giver (see `fulfilItems`).
//
// Persistence: Netlify DB (Neon Postgres) — see `server/utils/db.ts`.

import { subtractItems, type RequestItem } from '#shared/catalog'
import { accountKey, type RequesterIdentity } from '#shared/identity'

export type RequestStatus = 'open' | 'fulfilled'

export interface RequestAddress {
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode: string
  country: string
}

export interface BookRequest {
  id: string
  /**
   * The books this record covers. On an open request, what the reader is still
   * waiting for; on a fulfilled one, what a single sponsor paid for. Never empty.
   */
  items: RequestItem[]
  /** Public message shown on the board. */
  message: string
  /**
   * The public account the reader signed in with, shown on the board so a
   * sponsor can see who they are giving to. Null only on rows posted before
   * sign-in was required — those stay visible, marked unverified.
   */
  requester: RequesterIdentity | null
  // ── private contact + shipping (never exposed publicly) ──
  name: string
  email: string
  phone: string
  address: RequestAddress
  // ── lifecycle ──
  status: RequestStatus
  createdAt: string
  sponsorEmail?: string
  stripeSessionId?: string
  luluJobId?: string | number
  shippingStatus?: string
  fulfilledAt?: string
}

/**
 * The only fields safe to send to the browser.
 *
 * `requester` is public on purpose — it is the account the reader chose to
 * stand behind the request with. It is not the same as `name`, the shipping
 * name, which stays private along with the rest of the address.
 */
export interface PublicBookRequest {
  id: string
  items: RequestItem[]
  message: string
  requester: RequesterIdentity | null
  createdAt: string
}

export function toPublic(r: BookRequest): PublicBookRequest {
  return {
    id: r.id,
    items: r.items,
    message: r.message,
    requester: r.requester,
    createdAt: r.createdAt
  }
}

export interface CreateRequestInput {
  items: RequestItem[]
  message: string
  requester: RequesterIdentity
  name: string
  email: string
  phone: string
  address: RequestAddress
}

// Timestamps are stored as ISO text and the items/address as jsonb, so a row
// maps back to BookRequest losslessly with no Date/JSON coercion surprises.
let schema: Promise<void> | null = null
function ensureSchema() {
  if (!schema) {
    schema = (async () => {
      const sql = db()
      await sql`
        CREATE TABLE IF NOT EXISTS book_requests (
          id                text PRIMARY KEY,
          items             jsonb NOT NULL DEFAULT '[]'::jsonb,
          message           text NOT NULL,
          requester         jsonb,
          account_key       text,
          name              text NOT NULL,
          email             text NOT NULL,
          phone             text NOT NULL,
          address           jsonb NOT NULL,
          status            text NOT NULL DEFAULT 'open',
          created_at        text NOT NULL,
          sponsor_email     text,
          stripe_session_id text,
          lulu_job_id       text,
          shipping_status   text,
          fulfilled_at      text
        )
      `

      // Migration off the one-book-per-request schema. Tables created before
      // requests became orders have `book_slug` instead of `items`; fold each
      // legacy row into a single-line order. The old column is kept (nullable)
      // rather than dropped so the change stays reversible.
      await sql`ALTER TABLE book_requests ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb`
      await sql`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'book_requests' AND column_name = 'book_slug'
          ) THEN
            ALTER TABLE book_requests ALTER COLUMN book_slug DROP NOT NULL;
            UPDATE book_requests
               SET items = jsonb_build_array(
                     jsonb_build_object('slug', book_slug, 'quantity', 1))
             WHERE items = '[]'::jsonb AND book_slug IS NOT NULL;
          END IF;
        END $$
      `

      // Verified sign-in, added later. Both columns are nullable: rows posted
      // before it was required keep no account and show as unverified rather
      // than being deleted or silently attributed to someone.
      await sql`ALTER TABLE book_requests ADD COLUMN IF NOT EXISTS requester jsonb`
      await sql`ALTER TABLE book_requests ADD COLUMN IF NOT EXISTS account_key text`
      // `account_key` is derived from `requester` on every write; it exists as
      // its own column purely so "does this account already have a request
      // open?" is an index lookup rather than a scan over jsonb.
      await sql`
        CREATE INDEX IF NOT EXISTS book_requests_account_open_idx
          ON book_requests (account_key, status)
      `
    })()
  }
  return schema
}

function fromRow(r: Record<string, unknown>): BookRequest {
  return {
    id: r.id as string,
    items: (r.items as RequestItem[]) ?? [],
    message: r.message as string,
    // A legacy row has no requester at all; guard on `provider` so a stray
    // empty object reads as unverified rather than a blank-named account.
    requester: (r.requester as RequesterIdentity)?.provider ? (r.requester as RequesterIdentity) : null,
    name: r.name as string,
    email: r.email as string,
    phone: r.phone as string,
    address: r.address as RequestAddress,
    status: r.status as RequestStatus,
    createdAt: r.created_at as string,
    sponsorEmail: (r.sponsor_email as string) ?? undefined,
    stripeSessionId: (r.stripe_session_id as string) ?? undefined,
    luluJobId: (r.lulu_job_id as string) ?? undefined,
    shippingStatus: (r.shipping_status as string) ?? undefined,
    fulfilledAt: (r.fulfilled_at as string) ?? undefined
  }
}

// Full-row upsert, so create and update share one write path.
async function upsert(r: BookRequest) {
  await ensureSchema()
  await db()`
    INSERT INTO book_requests
      (id, items, message, requester, account_key, name, email, phone, address, status, created_at,
       sponsor_email, stripe_session_id, lulu_job_id, shipping_status, fulfilled_at)
    VALUES
      (${r.id}, ${JSON.stringify(r.items)}::jsonb, ${r.message},
       ${r.requester ? JSON.stringify(r.requester) : null}::jsonb,
       ${r.requester ? accountKey(r.requester) : null},
       ${r.name}, ${r.email}, ${r.phone},
       ${JSON.stringify(r.address)}::jsonb, ${r.status}, ${r.createdAt},
       ${r.sponsorEmail ?? null}, ${r.stripeSessionId ?? null},
       ${r.luluJobId != null ? String(r.luluJobId) : null},
       ${r.shippingStatus ?? null}, ${r.fulfilledAt ?? null})
    ON CONFLICT (id) DO UPDATE SET
      items = EXCLUDED.items,
      message = EXCLUDED.message,
      requester = EXCLUDED.requester,
      account_key = EXCLUDED.account_key,
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address,
      status = EXCLUDED.status,
      created_at = EXCLUDED.created_at,
      sponsor_email = EXCLUDED.sponsor_email,
      stripe_session_id = EXCLUDED.stripe_session_id,
      lulu_job_id = EXCLUDED.lulu_job_id,
      shipping_status = EXCLUDED.shipping_status,
      fulfilled_at = EXCLUDED.fulfilled_at
  `
}

export async function createRequest(input: CreateRequestInput): Promise<BookRequest> {
  const record: BookRequest = {
    id: crypto.randomUUID(),
    status: 'open',
    createdAt: new Date().toISOString(),
    ...input
  }
  await upsert(record)
  return record
}

export async function getRequest(id: string): Promise<BookRequest | null> {
  await ensureSchema()
  const rows = await db()`SELECT * FROM book_requests WHERE id = ${id}`
  return rows[0] ? fromRow(rows[0]) : null
}

export async function listOpenRequests(): Promise<BookRequest[]> {
  await ensureSchema()
  const rows = await db()`
    SELECT * FROM book_requests WHERE status = 'open' ORDER BY created_at DESC
  `
  return rows.map(fromRow)
}

/**
 * The request this account already has waiting on the board, if any.
 *
 * One open request per account is the main thing sign-in buys us: a scammer
 * can no longer paper the board with postings, because each one costs them a
 * fresh social account. It is per *open* request, so a reader whose books have
 * been sponsored is free to ask again.
 */
export async function findOpenRequestByAccount(key: string): Promise<BookRequest | null> {
  await ensureSchema()
  const rows = await db()`
    SELECT * FROM book_requests
     WHERE account_key = ${key} AND status = 'open'
     ORDER BY created_at ASC
     LIMIT 1
  `
  return rows[0] ? fromRow(rows[0]) : null
}

export async function findRequestByLuluJobId(jobId: string | number): Promise<BookRequest | null> {
  await ensureSchema()
  const rows = await db()`SELECT * FROM book_requests WHERE lulu_job_id = ${String(jobId)}`
  return rows[0] ? fromRow(rows[0]) : null
}

export async function updateRequest(id: string, patch: Partial<BookRequest>): Promise<BookRequest | null> {
  const current = await getRequest(id)
  if (!current) return null
  const next = { ...current, ...patch }
  await upsert(next)
  return next
}

/**
 * Mark the sponsored books of a request fulfilled and leave the rest on the board.
 *
 * A gift that covers everything simply closes the request. A partial gift is
 * split: the funded books move to their own fulfilled record — it carries the
 * Stripe session and Lulu job, so shipping updates land on the parcel they
 * belong to — and the original request keeps the copies nobody has funded yet.
 *
 * Returns the fulfilled record.
 */
export async function fulfilItems(
  request: BookRequest,
  funded: RequestItem[],
  patch: Partial<BookRequest>
): Promise<BookRequest> {
  const remaining = subtractItems(request.items, funded)

  if (remaining.length === 0) {
    const closed: BookRequest = { ...request, ...patch, items: funded, status: 'fulfilled' }
    await upsert(closed)
    return closed
  }

  const fulfilled: BookRequest = {
    ...request,
    ...patch,
    id: crypto.randomUUID(),
    items: funded,
    status: 'fulfilled'
  }
  await upsert(fulfilled)
  await upsert({ ...request, items: remaining })
  return fulfilled
}

export async function deleteRequest(id: string): Promise<void> {
  await ensureSchema()
  await db()`DELETE FROM book_requests WHERE id = ${id}`
}
