import type { BookRequest, PublicBookRequest } from './requests'
import { toPublic } from './requests'
import { publicAccountIdentities } from './readerAccounts'

/** Keep historical identities for ownership checks; refresh only the public view. */
export async function publicRequests(requests: BookRequest[]): Promise<PublicBookRequest[]> {
  const ids = [...new Set(requests.flatMap(r => r.accountId ? [r.accountId] : []))]
  const profiles = await publicAccountIdentities(ids)
  return requests.map(r => ({
    ...toPublic(r),
    requesters: r.accountId ? (profiles.get(r.accountId) ?? r.requesters) : r.requesters
  }))
}
