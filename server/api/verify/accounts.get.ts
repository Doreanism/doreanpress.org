// Durable identities attached to the account represented by this session.
// Provider profile data stays in Postgres; only this deliberately public subset
// is returned to the reader who owns the account.

import { listAttachedIdentities } from '../../utils/readerAccounts'

export default defineEventHandler(async (event) => {
  const { identities, email } = await listAttachedIdentities(event)
  return { identities, email, verified: identities.length > 0 }
})
