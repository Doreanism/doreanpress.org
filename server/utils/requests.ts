// Pay-it-forward book requests.
//
// A reader who cannot pay submits a request (a public message + private
// shipping details). Another visitor sponsors it; once paid + sent to Lulu the
// request is marked fulfilled and drops off the public board.
//
// Backed by Nitro storage (file driver by default — see nuxt.config `nitro`).
// The interface below is storage-agnostic: swap the driver for Postgres/KV
// without changing call sites.

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

const PREFIX = 'requests'
const keyFor = (id: string) => `${PREFIX}:${id}`
const store = () => useStorage('db')

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

export async function createRequest(input: CreateRequestInput): Promise<BookRequest> {
  const record: BookRequest = {
    id: crypto.randomUUID(),
    status: 'open',
    createdAt: new Date().toISOString(),
    ...input
  }
  await store().setItem(keyFor(record.id), record)
  return record
}

export async function getRequest(id: string): Promise<BookRequest | null> {
  return (await store().getItem<BookRequest>(keyFor(id))) || null
}

export async function listOpenRequests(): Promise<BookRequest[]> {
  const keys = await store().getKeys(PREFIX)
  const items = await Promise.all(keys.map(k => store().getItem<BookRequest>(k)))
  return items
    .filter((r): r is BookRequest => !!r && r.status === 'open')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function updateRequest(id: string, patch: Partial<BookRequest>): Promise<BookRequest | null> {
  const current = await getRequest(id)
  if (!current) return null
  const next = { ...current, ...patch }
  await store().setItem(keyFor(id), next)
  return next
}
