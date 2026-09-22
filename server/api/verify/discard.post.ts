// Detach a non-primary public profile.
//
// Removes the durable provider link from the reader's database account.
// Quiet when there is nothing to discard — the reader's intent ("that account is
// not on this request") is satisfied either way, and a 404 here would only be
// noise.
//
// `account` is the key from `accountKey`, which is what the client already has
// for every attached profile. The primary profile cannot be removed.
interface Body {
  account?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event).catch(() => null)
  const account = String(body?.account ?? '').slice(0, 300).trim()

  await discardProofs(event, account || undefined)
  return { ok: true }
})
