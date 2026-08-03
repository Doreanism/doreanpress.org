// Detach an account the reader attached — one of them, or all of them.
//
// Burns what it removes rather than only dropping the cookie: a proof the reader
// has deliberately walked away from should be as dead as one that was used.
// Quiet when there is nothing to discard — the reader's intent ("that account is
// not on this request") is satisfied either way, and a 404 here would only be
// noise.
//
// `account` is the key from `accountKey`, which is what the client already has
// for every attached profile. Absent, everything goes.
interface Body {
  account?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<Body>(event).catch(() => null)
  const account = String(body?.account ?? '').slice(0, 300).trim()

  await discardProofs(event, account || undefined)
  return { ok: true }
})
