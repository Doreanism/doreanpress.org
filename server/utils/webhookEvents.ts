// A durable record of which Stripe deliveries have already been acted on.
//
// Stripe retries a delivery until it gets a 2xx, and the same checkout session
// can also arrive under more than one event type. Acting twice books a second
// print job and ships a second parcel, so the guard has to be real — and it has
// to outlive the process, because each delivery may land on a different (or
// cold) serverless instance where an in-memory Set is empty. That is exactly
// the case the previous in-memory guard missed.
//
// Keyed on the checkout session rather than the event id: the session is what
// identifies "this purchase", so it also covers the same session arriving under
// a second event type.

/** Written and read on the sponsorship/order fulfilment path only. */
let schema: Promise<void> | null = null
function ensureSchema() {
  if (!schema) {
    schema = db()`
      CREATE TABLE IF NOT EXISTS processed_events (
        id           text PRIMARY KEY,
        processed_at text NOT NULL
      )
    `.then(() => undefined)
  }
  return schema
}

/**
 * Stake a claim on a delivery. True means this caller won it and should do the
 * work; false means someone already has, and this delivery is a duplicate.
 *
 * The insert *is* the lock. Two deliveries racing on separate instances both
 * reach here, and Postgres lets exactly one of them win the primary key.
 */
export async function claimEvent(id: string): Promise<boolean> {
  await ensureSchema()
  const rows = await db()`
    INSERT INTO processed_events (id, processed_at)
    VALUES (${id}, ${new Date().toISOString()})
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `
  return rows.length > 0
}

/**
 * Hand a claim back so Stripe's next retry is treated as fresh work.
 *
 * Only ever safe while nothing irreversible has happened yet. Once a print job
 * exists the parcel is committed, and releasing would let a retry print a
 * second one — which is the whole thing this module exists to prevent.
 */
export async function releaseEvent(id: string): Promise<void> {
  await ensureSchema()
  await db()`DELETE FROM processed_events WHERE id = ${id}`
}
