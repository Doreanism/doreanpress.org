import type { H3Event } from 'h3'
import type { SignedIn } from '#shared/account'
import type { RequesterIdentity } from '#shared/identity'

interface AccountRow {
  id: string
  email?: string | null
}

interface IdentityRow {
  identity: RequesterIdentity | string
  provider_email?: string | null
}

let schema: Promise<void> | null = null

function ensureSchema() {
  if (!schema) {
    schema = (async () => {
      const sql = db()
      await sql`
        CREATE TABLE IF NOT EXISTS reader_accounts (
          id         text PRIMARY KEY,
          email      text UNIQUE,
          created_at text NOT NULL,
          updated_at text NOT NULL
        )
      `
      await sql`
        CREATE TABLE IF NOT EXISTS reader_emails (
          email text PRIMARY KEY,
          account_id text NOT NULL REFERENCES reader_accounts(id) ON DELETE CASCADE,
          verified_at timestamptz NOT NULL DEFAULT now()
        )
      `
      await sql`CREATE INDEX IF NOT EXISTS reader_emails_account_idx ON reader_emails(account_id)`
      await sql`INSERT INTO reader_emails(email, account_id)
        SELECT email, id FROM reader_accounts WHERE email IS NOT NULL ON CONFLICT DO NOTHING`
      await sql`
        CREATE TABLE IF NOT EXISTS reader_identities (
          account_id      text NOT NULL REFERENCES reader_accounts(id) ON DELETE CASCADE,
          provider        text NOT NULL,
          subject         text NOT NULL,
          identity        jsonb NOT NULL,
          provider_email  text,
          attached_at     text NOT NULL,
          last_verified_at text NOT NULL,
          PRIMARY KEY (account_id, provider, subject),
          UNIQUE (provider, subject)
        )
      `
      // Early builds allowed only one identity per provider. Widen the key in
      // place so a reader may link, for example, both a personal and ministry X
      // account while the global provider+subject uniqueness still prevents one
      // social account from belonging to two Dorean accounts.
      await sql`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
              FROM pg_constraint
             WHERE conrelid = 'reader_identities'::regclass
               AND conname = 'reader_identities_pkey'
               AND pg_get_constraintdef(oid) = 'PRIMARY KEY (account_id, provider)'
          ) THEN
            ALTER TABLE reader_identities DROP CONSTRAINT reader_identities_pkey;
            ALTER TABLE reader_identities
              ADD CONSTRAINT reader_identities_pkey PRIMARY KEY (account_id, provider, subject);
          END IF;
        END $$
      `
      await sql`
        CREATE INDEX IF NOT EXISTS reader_identities_account_idx
          ON reader_identities (account_id, attached_at)
      `
    })().catch((err) => {
      schema = null
      throw err
    })
  }
  return schema
}

function identityFrom(value: RequesterIdentity | string): RequesterIdentity {
  return typeof value === 'string' ? JSON.parse(value) as RequesterIdentity : value
}

function labelFor(identity: RequesterIdentity, email?: string | null) {
  return email || (identity.handle ? `@${identity.handle}` : identity.name)
}

async function mergeAccounts(target: string, source: string) {
  if (target === source) return
  const sql = db()
  // Only legacy provider-only sessions are migrated. Move the links and remove
  // the empty account together so a failed write cannot strand the reader.
  await sql.transaction([
    sql`SELECT id FROM reader_accounts WHERE id = ${source} FOR UPDATE`,
    sql`UPDATE reader_identities SET account_id = ${target} WHERE account_id = ${source}`,
    sql`DELETE FROM reader_accounts WHERE id = ${source}`
  ])
}

async function accountRow(id: string): Promise<AccountRow | null> {
  const rows = await db()`SELECT id, email FROM reader_accounts WHERE id = ${id}` as AccountRow[]
  return rows[0] ?? null
}

export async function sessionAccountId(event: H3Event): Promise<string | null> {
  const session = await getUserSession(event)
  return session.accountId || session.signedIn?.accountId || null
}

/** Link a provider identity to the email-authenticated account, never log in through it. */
export async function attachIdentity(
  event: H3Event,
  identity: RequesterIdentity,
  providerEmail?: string
): Promise<SignedIn> {
  await ensureSchema()
  const sql = db()
  const signedIn = await requireEmailAccount(event, 'attaching a social profile')
  const accountId = signedIn.accountId
  const account = await accountRow(accountId)
  if (!account?.email || account.email !== signedIn.email) {
    throw createError({ statusCode: 401, statusMessage: 'Please sign in with your email again.' })
  }
  const linked = await sql`
    SELECT account_id FROM reader_identities
     WHERE provider = ${identity.provider} AND subject = ${identity.subject}
  ` as { account_id: string }[]
  if (linked[0] && linked[0].account_id !== accountId) {
    throw createError({ statusCode: 409, statusMessage: 'This social profile is already linked to another account.' })
  }

  const now = new Date().toISOString()
  const attached = await sql`
    INSERT INTO reader_identities
      (account_id, provider, subject, identity, provider_email, attached_at, last_verified_at)
    VALUES
      (${accountId}, ${identity.provider}, ${identity.subject},
       ${JSON.stringify(identity)}::jsonb, ${providerEmail || null}, ${now}, ${now})
    ON CONFLICT (provider, subject) DO UPDATE SET
      identity = EXCLUDED.identity,
      provider_email = COALESCE(EXCLUDED.provider_email, reader_identities.provider_email),
      last_verified_at = EXCLUDED.last_verified_at
    WHERE reader_identities.account_id = EXCLUDED.account_id
    RETURNING account_id
  `
  if (!attached.length) {
    throw createError({ statusCode: 409, statusMessage: 'This social profile is already linked to another account.' })
  }

  return {
    accountId,
    email: account?.email || undefined,
    label: labelFor(identity, account?.email),
    at: now
  }
}

/** Link an authenticated inbox, merging any provider-only account in this browser. */
export async function attachEmail(event: H3Event, email: string): Promise<SignedIn> {
  await ensureSchema()
  const address = normalizeEmail(email)
  const current = await sessionAccountId(event)
  const existing = current ? await accountRow(current) : null
  const now = new Date().toISOString()
  const sql = db()
  const results = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${address}, 0))`,
    sql`INSERT INTO reader_accounts(id, email, created_at, updated_at)
      SELECT ${crypto.randomUUID()}, ${address}, ${now}, ${now}
      WHERE NOT EXISTS (SELECT 1 FROM reader_emails WHERE email = ${address})
      ON CONFLICT (email) DO NOTHING`,
    sql`INSERT INTO reader_emails(email, account_id)
      SELECT email, id FROM reader_accounts WHERE email = ${address} ON CONFLICT DO NOTHING`,
    sql`SELECT a.id, a.email FROM reader_accounts a JOIN reader_emails e ON e.account_id = a.id WHERE e.email = ${address}`
  ])
  const account = results[3]![0] as unknown as AccountRow
  const accountId = account.id
  // Migrate a legacy provider-only account, but never merge two email accounts
  // just because someone signs into a different inbox in this browser.
  if (existing && !existing.email && current !== accountId) await mergeAccounts(accountId, existing.id)
  return { accountId, email: account.email!, label: account.email!, at: new Date().toISOString() }
}

export async function listAttachedIdentities(event: H3Event): Promise<{
  identities: RequesterIdentity[]
  email?: string
}> {
  await ensureSchema()
  const accountId = await sessionAccountId(event)
  if (!accountId) return { identities: [] }
  const [account, rows] = await Promise.all([
    accountRow(accountId),
    db()`
      SELECT identity, provider_email FROM reader_identities
       WHERE account_id = ${accountId}
       ORDER BY attached_at ASC
    ` as unknown as Promise<IdentityRow[]>
  ])
  const identities = rows.map(row => identityFrom(row.identity))
  const email = account?.email || rows.find(row => row.provider_email)?.provider_email || undefined
  return { identities, email: email || undefined }
}

export async function detachIdentity(event: H3Event, key?: string): Promise<void> {
  await ensureSchema()
  const accountId = await sessionAccountId(event)
  if (!accountId) return
  const lastIdentity = () => createError({ statusCode: 409, statusMessage: 'LAST_IDENTITY', data: { code: 'LAST_IDENTITY' },
    message: 'Add another public account before removing this one.' })
  if (!key) throw lastIdentity()
  const split = key.indexOf(':')
  if (split < 1) return
  const provider = key.slice(0, split)
  const subject = key.slice(split + 1)
  const sql = db()
  // Lock the parent first. Each subsequent statement gets a fresh READ COMMITTED
  // snapshot, including a concurrent detach that finished while we waited.
  const results = await sql.transaction([
    sql`SELECT id FROM reader_accounts WHERE id = ${accountId} FOR UPDATE`,
    sql`DELETE FROM reader_identities WHERE account_id = ${accountId}
      AND provider = ${provider} AND subject = ${subject}
      AND (SELECT count(*) FROM reader_identities WHERE account_id = ${accountId}) > 1
      RETURNING subject`,
    sql`SELECT subject FROM reader_identities WHERE account_id = ${accountId}
      AND provider = ${provider} AND subject = ${subject}`
  ])
  if (results[2]!.length) throw lastIdentity()
}

/** Always resolve the primary address from the database, including older sessions. */
export async function readAccount(id: string): Promise<AccountRow | null> {
  await ensureSchema()
  return accountRow(id)
}

export async function accountEmails(accountId: string): Promise<{ email: string, primary: boolean }[]> {
  await ensureSchema()
  const rows = await db()`SELECT e.email, (e.email = a.email) AS primary
    FROM reader_emails e JOIN reader_accounts a ON a.id = e.account_id
    WHERE a.id = ${accountId} ORDER BY (e.email = a.email) DESC, e.verified_at, e.email`
  return rows as { email: string, primary: boolean }[]
}

/** Called only after consuming a verification token bound to this account. */
export async function addVerifiedEmail(accountId: string, email: string): Promise<void> {
  await ensureSchema()
  const address = normalizeEmail(email)
  const sql = db()
  const results = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(hashtextextended(${address}, 0))`,
    sql`INSERT INTO reader_emails(email, account_id) VALUES (${address}, ${accountId})
      ON CONFLICT (email) DO UPDATE SET verified_at = now()
      WHERE reader_emails.account_id = EXCLUDED.account_id RETURNING email`
  ])
  if (!results[1]!.length) throw createError({ statusCode: 409, statusMessage: 'That email belongs to another account. Sign in with that email to manage it.' })
}

export async function setPrimaryEmail(accountId: string, email: string): Promise<void> {
  await ensureSchema()
  const sql = db()
  const results = await sql.transaction([
    sql`SELECT id FROM reader_accounts WHERE id = ${accountId} FOR UPDATE`,
    sql`UPDATE reader_accounts SET email = ${normalizeEmail(email)}, updated_at = ${new Date().toISOString()}
      WHERE id = ${accountId} AND EXISTS (SELECT 1 FROM reader_emails WHERE account_id = ${accountId} AND email = ${normalizeEmail(email)}) RETURNING id`
  ])
  if (!results[1]!.length) throw createError({ statusCode: 422, statusMessage: 'Verify that email before making it primary.' })
}

export async function removeAccountEmail(accountId: string, email: string): Promise<void> {
  await ensureSchema()
  const sql = db()
  // Keep the primary until the reader explicitly chooses another. This also
  // protects the last email under concurrent removals and primary changes.
  const results = await sql.transaction([
    sql`SELECT id FROM reader_accounts WHERE id = ${accountId} FOR UPDATE`,
    sql`DELETE FROM reader_emails WHERE account_id = ${accountId} AND email = ${normalizeEmail(email)}
      AND email <> (SELECT email FROM reader_accounts WHERE id = ${accountId}) RETURNING email`
  ])
  if (!results[1]!.length) throw createError({ statusCode: 409, statusMessage: 'Choose another verified email as primary before removing this one. Your account must keep at least one email.' })
}

/** Resolve notification delivery at send time so queued shipping notices follow primary changes. */
export async function primaryNotificationEmail(email: string, accountId?: string): Promise<string> {
  await ensureSchema()
  if (accountId) return (await accountRow(accountId))?.email || email
  const rows = await db()`SELECT a.email FROM reader_accounts a JOIN reader_emails e ON e.account_id = a.id WHERE e.email = ${normalizeEmail(email)}`
  return String(rows[0]?.email || email)
}
