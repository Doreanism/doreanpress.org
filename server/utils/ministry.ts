import type { H3Event } from 'h3'

let schema: Promise<void> | null = null
export function ensureMinistrySchema() {
  if (!schema) schema = (async () => {
    await ensureRequestsSchema()
    const sql = db()
    await sql`ALTER TABLE book_requests ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false`
    await sql`ALTER TABLE book_requests ADD COLUMN IF NOT EXISTS fulfillment jsonb NOT NULL DEFAULT '{}'::jsonb`
    await sql`ALTER TABLE book_requests ADD COLUMN IF NOT EXISTS tracker_lease_until timestamptz`
    await sql`CREATE TABLE IF NOT EXISTS ministry_tracking_events (id text PRIMARY KEY, tracker_id text NOT NULL, status text NOT NULL, occurred_at timestamptz NOT NULL)`
    await sql`CREATE TABLE IF NOT EXISTS account_roles (
      account_id text NOT NULL, role text NOT NULL, granted_at timestamptz NOT NULL DEFAULT now(),
      granted_by text NOT NULL, PRIMARY KEY (account_id, role))`
    await sql`CREATE TABLE IF NOT EXISTS ministry_audit (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, account_id text NOT NULL,
      request_id text, action text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`
    await sql`CREATE TABLE IF NOT EXISTS gift_reservations (
      id text PRIMARY KEY, request_id text NOT NULL, items jsonb NOT NULL,
      expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`
    await sql`ALTER TABLE gift_reservations ADD COLUMN IF NOT EXISTS original_items jsonb`
    await sql`CREATE INDEX IF NOT EXISTS gift_reservations_request_idx ON gift_reservations(request_id, expires_at)`
    await sql`CREATE TABLE IF NOT EXISTS ministry_gifts (
      payment_id text PRIMARY KEY, event_id text UNIQUE NOT NULL, amount_cents integer NOT NULL,
      currency text NOT NULL, donor_email text, receipt_url text, recommendation_id text,
      request_id text, allocation text NOT NULL DEFAULT 'general', created_at timestamptz NOT NULL DEFAULT now())`
    await sql`CREATE TABLE IF NOT EXISTS ministry_outbox (
      id text PRIMARY KEY, recipient text NOT NULL, subject text NOT NULL, body text NOT NULL,
      sent_at timestamptz, lease_until timestamptz)`
    await sql`ALTER TABLE ministry_outbox ADD COLUMN IF NOT EXISTS account_id text`
  })().catch((err) => {
    schema = null
    throw err
  })
  return schema
}

export async function requireAdministrator(event: H3Event, fresh = false) {
  const signedIn = await readSignedIn(event)
  if (!signedIn) throw createError({ statusCode: 401, statusMessage: 'Sign in to administer orders.' })
  await ensureMinistrySchema()
  const roles = await db()`SELECT role FROM account_roles JOIN reader_accounts ON reader_accounts.id = account_roles.account_id WHERE account_id = ${signedIn.accountId} AND role = 'fulfillment_admin'`
  if (!roles.length) throw createError({ statusCode: 403, statusMessage: 'Administrator access required.' })
  if (fresh && (!Number.isFinite(Date.parse(signedIn.at)) || Date.now() - Date.parse(signedIn.at) > 15 * 60_000)) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in again to access private fulfillment details.' })
  }
  setResponseHeader(event, 'Cache-Control', 'private, no-store')
  return signedIn
}

export async function auditMinistry(account: string, id: string, action: string) {
  await db()`INSERT INTO ministry_audit(account_id, request_id, action) VALUES (${account}, ${id}, ${action})`
}

export async function flushMinistryEmails() {
  const sql = db()
  const rows = await sql`UPDATE ministry_outbox SET lease_until = now() + interval '5 minutes'
    WHERE id IN (SELECT id FROM ministry_outbox WHERE sent_at IS NULL
      AND (lease_until IS NULL OR lease_until < now()) LIMIT 20 FOR UPDATE SKIP LOCKED)
    RETURNING id, recipient, subject, body, account_id`
  for (const row of rows) {
    try {
      const text = String(row.body)
      const html = `<pre>${text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]!)}</pre>`
      await sendEmail({ to: await primaryNotificationEmail(String(row.recipient), row.account_id ? String(row.account_id) : undefined), subject: String(row.subject), text, html }, true)
      await sql`UPDATE ministry_outbox SET sent_at = now(), lease_until = NULL WHERE id = ${row.id}`
    } catch {
      await sql`UPDATE ministry_outbox SET lease_until = NULL WHERE id = ${row.id}`
    }
  }
}
