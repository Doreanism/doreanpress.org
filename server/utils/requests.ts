// Pay-it-forward book requests.
//
// A reader who cannot pay submits a request — an *order* of one or more titles,
// with a public message and private shipping details. A visitor sponsors it,
// either in full or in part; once paid + sent to Lulu the sponsored books are
// marked fulfilled and drop off the public board, while anything still unfunded
// stays there for the next giver (see `fulfilItems`).
//
// Persistence: Netlify DB (Neon Postgres) — see `server/utils/db.ts`.

import { mergeItems, subtractItems, type RequestItem } from '#shared/catalog'
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
   * The public account the reader proved, shown on the board so a
   * sponsor can see who they are giving to. Null only on rows posted before
   * verification was required — those stay visible, marked unverified.
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

/** Case, punctuation and stray spacing carry no meaning in an address here. */
const normalize = (v?: string) =>
  (v ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** As above, but with the gaps closed too — for a postcode, spacing is styling. */
const squash = (v?: string) => normalize(v).replace(/ /g, '')

/**
 * Where the parcel would actually go, as one comparable string.
 *
 * Used both to group the board and to decide whether a second request from an
 * account is another go at the same doorstep, so it has to survive a reader
 * retyping their own address: `SW1A 1AA` and `sw1a1aa`, `Apt. 4` and `Apt 4`,
 * are each one place. What it will not do is guess — `12 Bell St` and
 * `12 Bell Street` stay two destinations, which fails toward asking rather than
 * toward posting somebody's books to the wrong house.
 *
 * The recipient name counts: a reader shipping to their own flat and to a
 * friend's is asking for two destinations, not one.
 */
export function destinationKey(r: Pick<BookRequest, 'name' | 'address'>): string {
  const a = r.address
  return [
    normalize(r.name),
    normalize(a.line1),
    normalize(a.line2),
    normalize(a.city),
    normalize(a.state),
    squash(a.postalCode),
    squash(a.country)
  ].join('|')
}

/** Where an account's open order lives: one order per doorstep. */
export function orderKey(r: BookRequest): string | null {
  return r.requester ? `${accountKey(r.requester)}@${destinationKey(r)}` : null
}

/** As much of a message as one card should ever have to carry. */
const MAX_MESSAGE = 2000

/**
 * The one order a reader ends up with when they ask again for the same doorstep.
 *
 * Not a second posting beside the first: the same order, grown. The copies add
 * up per title, and the new words are kept under the old ones — a reader who
 * comes back to add a book usually says why, and dropping either half would
 * either lose their reason or lose their update. Oldest paragraphs fall off the
 * front once it runs long, so a reader who returns ten times cannot turn one
 * card into a wall of text.
 */
export function foldOrders(
  existing: Pick<BookRequest, 'items' | 'message'>,
  incoming: Pick<BookRequest, 'items' | 'message'>
): Pick<BookRequest, 'items' | 'message'> {
  const said = existing.message.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  const adding = incoming.message.trim()
  // Somebody re-submitting the same form should not have their words doubled.
  if (adding && !said.includes(adding)) said.push(adding)

  while (said.length > 1 && said.join('\n\n').length > MAX_MESSAGE) said.shift()

  return {
    items: mergeItems([existing.items, incoming.items]),
    message: said.join('\n\n').slice(0, MAX_MESSAGE)
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

      // Verified identity, added later. Both columns are nullable: rows posted
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

      // One open order per doorstep, applied to what is already there. Under the
      // old rule a reader's second request became a second row, and the board
      // drew them as two cards for one person waiting on one parcel. Those rows
      // are folded into the earliest of them — the id a confirmation email and
      // any in-flight checkout already point at — rather than left for the board
      // to paper over.
      const open = await sql`
        SELECT * FROM book_requests
         WHERE status = 'open' AND account_key IS NOT NULL
         ORDER BY created_at ASC
      `
      const byDoorstep = new Map<string, BookRequest[]>()
      for (const row of open) {
        const request = fromRow(row)
        const key = orderKey(request)
        if (!key) continue
        byDoorstep.set(key, [...(byDoorstep.get(key) ?? []), request])
      }
      for (const [first, ...rest] of byDoorstep.values()) {
        if (!first || rest.length === 0) continue
        const folded = rest.reduce<Pick<BookRequest, 'items' | 'message'>>(foldOrders, first)
        await sql`
          UPDATE book_requests
             SET items = ${JSON.stringify(folded.items)}::jsonb, message = ${folded.message}
           WHERE id = ${first.id}
        `
        for (const spent of rest) await sql`DELETE FROM book_requests WHERE id = ${spent.id}`
      }
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
 * Everything this account already has waiting on the board.
 *
 * One open *destination* per account is what the challenge buys us: a scammer
 * can no longer paper the board with postings, because every extra doorstep
 * costs them a fresh social account. Asking again for the same doorstep is not
 * papering anything — it is one reader adding a book they forgot — so that ask
 * joins the order already there (`foldOrders`) instead of becoming a row of its
 * own. The caller compares destinations; this only fetches. Open orders only, so
 * a reader whose books have been sponsored starts again with a clean slate.
 */
export async function listOpenRequestsByAccount(key: string): Promise<BookRequest[]> {
  await ensureSchema()
  const rows = await db()`
    SELECT * FROM book_requests
     WHERE account_key = ${key} AND status = 'open'
     ORDER BY created_at ASC
  `
  return rows.map(fromRow)
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
