import { createHash, randomBytes } from 'node:crypto'
import { loginReturnPath } from '#shared/login'

let schema: Promise<void> | null = null
function ensureSchema() {
  if (!schema) {
    schema = (async () => {
      await db()`
      CREATE TABLE IF NOT EXISTS email_login_links (
        email text PRIMARY KEY,
        token_hash text NOT NULL UNIQUE,
        return_path text NOT NULL,
        expires_at timestamptz NOT NULL,
        consumed boolean NOT NULL DEFAULT false,
        window_start timestamptz NOT NULL,
        sends integer NOT NULL
      )
    `
      await db()`ALTER TABLE email_login_links ADD COLUMN IF NOT EXISTS account_id text`
    })().catch((error) => {
      schema = null
      throw error
    })
  }
  return schema
}

export function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase()
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Atomic per-inbox budget survives resends and successful sign-ins. */
export async function issueLoginLink(email: string, redirect?: string, accountId?: string): Promise<string | null> {
  await ensureSchema()
  const token = randomBytes(32).toString('hex')
  const rows = await db()`
    INSERT INTO email_login_links (email, token_hash, return_path, expires_at, window_start, sends, account_id)
    VALUES (${normalizeEmail(email)}, ${hashToken(token)}, ${loginReturnPath(redirect)}, now() + interval '10 minutes', now(), 1, ${accountId || null})
    ON CONFLICT (email) DO UPDATE SET
      token_hash = EXCLUDED.token_hash,
      account_id = EXCLUDED.account_id,
      return_path = EXCLUDED.return_path,
      expires_at = EXCLUDED.expires_at,
      consumed = false,
      window_start = CASE WHEN email_login_links.window_start <= now() - interval '15 minutes'
        THEN now() ELSE email_login_links.window_start END,
      sends = CASE WHEN email_login_links.window_start <= now() - interval '15 minutes'
        THEN 1 ELSE email_login_links.sends + 1 END
    WHERE email_login_links.sends < 5
      OR email_login_links.window_start <= now() - interval '15 minutes'
    RETURNING email
  `
  await db()`DELETE FROM email_login_links WHERE window_start < now() - interval '1 day'`
  return rows.length ? token : null
}

/** A link is consumed only by a POST, atomically even across servers. */
export async function consumeLoginLink(token: string, accountId?: string): Promise<{ email: string, redirect: string, accountId?: string } | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) return null
  await ensureSchema()
  const rows = await db()`
    UPDATE email_login_links SET consumed = true
    WHERE token_hash = ${hashToken(token)} AND NOT consumed AND expires_at > now()
      AND (account_id IS NULL OR account_id = ${accountId || null})
    RETURNING email, return_path, account_id
  `
  return rows.length ? { email: String(rows[0]!.email), redirect: loginReturnPath(rows[0]!.return_path), ...(rows[0]!.account_id ? { accountId: String(rows[0]!.account_id) } : {}) } : null
}
