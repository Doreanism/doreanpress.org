// Pay-it-forward book requests.
//
// A reader who cannot pay submits a request (a public message + private
// shipping details). Another visitor sponsors it; once paid + sent to Lulu the
// request is marked fulfilled and drops off the public board.
//
// Persistence: Netlify DB (Neon Postgres). `neon()` reads NETLIFY_DATABASE_URL,
// which Netlify injects in production and `netlify dev` injects locally — run
// `netlify db init` once to provision it.

import { neon } from '@netlify/neon'
import { neon as neonDirect, neonConfig } from '@neondatabase/serverless'

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
  bookSlug: string
  /** Public message shown on the board. */
  message: string
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

/** The only fields safe to send to the browser. */
export interface PublicBookRequest {
  id: string
  bookSlug: string
  message: string
  createdAt: string
}

export function toPublic(r: BookRequest): PublicBookRequest {
  return { id: r.id, bookSlug: r.bookSlug, message: r.message, createdAt: r.createdAt }
}

export interface CreateRequestInput {
  bookSlug: string
  message: string
  name: string
  email: string
  phone: string
  address: RequestAddress
}

// Lazy so the app can boot without the env var; the first API call that needs
// the database fails with an actionable message instead of a boot-time crash.
type Sql = ReturnType<typeof neon>
let _sql: Sql | null = null
function db(): Sql {
  if (!_sql) {
    if (!process.env.NETLIFY_DATABASE_URL) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Database not configured',
        message: 'NETLIFY_DATABASE_URL is not set. Either run the local stack (docker compose -f docker-compose.dev.yml up -d, then set NETLIFY_DATABASE_URL + NEON_LOCAL_PROXY_ENDPOINT per .env.example), or run `netlify db init` once and use `netlify dev` so the URL is injected.'
      })
    }

    // Local dev: point the Neon serverless HTTP driver at the proxy container
    // from docker-compose.dev.yml instead of a Neon cloud endpoint.
    //
    // `fetchEndpoint` is global-config only (not a per-call `neon()` option), and
    // @netlify/neon loads its own CJS copy of the driver — so setting the config
    // there wouldn't affect a client built from this ESM copy. Both the config and
    // the client therefore come from the same direct import in this branch.
    // Unset in production, where @netlify/neon talks to the real Netlify DB.
    const localEndpoint = process.env.NEON_LOCAL_PROXY_ENDPOINT
    if (localEndpoint) {
      neonConfig.fetchEndpoint = localEndpoint
      _sql = neonDirect(process.env.NETLIFY_DATABASE_URL) as Sql
    } else {
      _sql = neon()
    }
  }
  return _sql
}

// Timestamps are stored as ISO text and the address as jsonb, so a row maps
// back to BookRequest losslessly with no Date/JSON coercion surprises.
let schema: Promise<void> | null = null
function ensureSchema() {
  if (!schema) {
    schema = db()`
      CREATE TABLE IF NOT EXISTS book_requests (
        id                text PRIMARY KEY,
        book_slug         text NOT NULL,
        message           text NOT NULL,
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
    `.then(() => undefined)
  }
  return schema
}

function fromRow(r: Record<string, unknown>): BookRequest {
  return {
    id: r.id as string,
    bookSlug: r.book_slug as string,
    message: r.message as string,
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
      (id, book_slug, message, name, email, phone, address, status, created_at,
       sponsor_email, stripe_session_id, lulu_job_id, shipping_status, fulfilled_at)
    VALUES
      (${r.id}, ${r.bookSlug}, ${r.message}, ${r.name}, ${r.email}, ${r.phone},
       ${JSON.stringify(r.address)}::jsonb, ${r.status}, ${r.createdAt},
       ${r.sponsorEmail ?? null}, ${r.stripeSessionId ?? null},
       ${r.luluJobId != null ? String(r.luluJobId) : null},
       ${r.shippingStatus ?? null}, ${r.fulfilledAt ?? null})
    ON CONFLICT (id) DO UPDATE SET
      book_slug = EXCLUDED.book_slug,
      message = EXCLUDED.message,
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

export async function deleteRequest(id: string): Promise<void> {
  await ensureSchema()
  await db()`DELETE FROM book_requests WHERE id = ${id}`
}
