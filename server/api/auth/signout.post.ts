// End the sign-in. Attached accounts are left alone — see `signOut`.

export default defineEventHandler(async (event) => {
  await signOut(event)
  return { signedIn: null }
})
