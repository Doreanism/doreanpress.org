/** Bind historical records while the inbox is verified; removal never transfers ownership. */
export async function claimAccountRecords(accountId: string): Promise<void> {
  await accountEmails(accountId)
  await ensureMinistrySchema()
  const sql = db()
  await sql.transaction([
    sql`UPDATE book_requests r SET account_id = ${accountId} FROM reader_emails e
      WHERE r.account_id IS NULL AND lower(r.email) = e.email AND e.account_id = ${accountId}`,
    sql`UPDATE book_requests r SET sponsor_account_id = ${accountId} FROM reader_emails e
      WHERE r.sponsor_account_id IS NULL AND lower(r.sponsor_email) = e.email AND e.account_id = ${accountId}`,
    sql`UPDATE ministry_outbox o SET account_id = ${accountId} FROM reader_emails e
      WHERE o.account_id IS NULL AND lower(o.recipient) = e.email AND e.account_id = ${accountId}`
  ])
}
