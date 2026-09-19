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

async function createAccount(id: string) {
  const now = new Date().toISOString()
  await db()`
    INSERT INTO reader_accounts (id, created_at, updated_at)
    VALUES (${id}, ${now}, ${now})
    ON CONFLICT (id) DO NOTHING
  `
}

async function mergeAccounts(target: string, source: string) {
  if (target === source) return
  const sql = db()
  const sourceRows = await sql`SELECT email FROM reader_accounts WHERE id = ${source}` as AccountRow[]

  // `provider + subject` is globally unique, so two accounts being merged
  // cannot contain the same social identity. Different identities from the
  // same provider are intentionally kept.
  await sql`UPDATE reader_identities SET account_id = ${target} WHERE account_id = ${source}`
  await sql`DELETE FROM reader_accounts WHERE id = ${source}`

  const sourceEmail = sourceRows[0]?.email
  if (sourceEmail) {
    await sql`
      UPDATE reader_accounts
         SET email = COALESCE(email, ${sourceEmail}), updated_at = ${new Date().toISOString()}
       WHERE id = ${target}
    `
  }
}

async function accountRow(id: string): Promise<AccountRow | null> {
  const rows = await db()`SELECT id, email FROM reader_accounts WHERE id = ${id}` as AccountRow[]
  return rows[0] ?? null
}

export async function sessionAccountId(event: H3Event): Promise<string | null> {
  const session = await getUserSession(event)
  return session.accountId || session.signedIn?.accountId || null
}

/** Persist a provider identity and return the durable account it authenticates. */
export async function attachIdentity(
  event: H3Event,
  identity: RequesterIdentity,
  providerEmail?: string
): Promise<SignedIn> {
  await ensureSchema()
  const sql = db()
  const current = await sessionAccountId(event)
  const linked = await sql`
    SELECT account_id FROM reader_identities
     WHERE provider = ${identity.provider} AND subject = ${identity.subject}
  ` as { account_id: string }[]

  // An existing provider identity is a login. Any identities accumulated in
  // this browser are merged because the reader has now authenticated both sets.
  const accountId = linked[0]?.account_id || current || crypto.randomUUID()
  await createAccount(accountId)
  if (current && current !== accountId) await mergeAccounts(accountId, current)

  const now = new Date().toISOString()
  await sql`
    INSERT INTO reader_identities
      (account_id, provider, subject, identity, provider_email, attached_at, last_verified_at)
    VALUES
      (${accountId}, ${identity.provider}, ${identity.subject},
       ${JSON.stringify(identity)}::jsonb, ${providerEmail || null}, ${now}, ${now})
    ON CONFLICT (provider, subject) DO UPDATE SET
      identity = EXCLUDED.identity,
      provider_email = COALESCE(EXCLUDED.provider_email, reader_identities.provider_email),
      last_verified_at = EXCLUDED.last_verified_at
  `

  const account = await accountRow(accountId)
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
  const rows = await db()`SELECT id, email FROM reader_accounts WHERE email = ${address}` as AccountRow[]
  const accountId = rows[0]?.id || current || crypto.randomUUID()
  await createAccount(accountId)
  if (current && current !== accountId) await mergeAccounts(accountId, current)
  await db()`
    UPDATE reader_accounts
       SET email = ${address}, updated_at = ${new Date().toISOString()}
     WHERE id = ${accountId}
  `
  return { accountId, email: address, label: address, at: new Date().toISOString() }
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
  if (!key) {
    await db()`DELETE FROM reader_identities WHERE account_id = ${accountId}`
    return
  }
  const split = key.indexOf(':')
  if (split < 1) return
  const provider = key.slice(0, split)
  const subject = key.slice(split + 1)
  await db()`
    DELETE FROM reader_identities
     WHERE account_id = ${accountId} AND provider = ${provider} AND subject = ${subject}
  `
}
