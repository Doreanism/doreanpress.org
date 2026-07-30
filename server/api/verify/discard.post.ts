// Abandon the proof in hand, because the reader wants to show a different
// account than the one they verified.
//
// Burns it rather than only dropping the cookie: a proof the reader has
// deliberately walked away from should be as dead as one that was used. Quiet
// when there is nothing to discard — the reader's intent ("I am not verified
// now") is satisfied either way, and a 404 here would only be noise.
export default defineEventHandler(async (event) => {
  await spendProof(event)
  return { ok: true }
})
