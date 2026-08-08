// Whether this browser is signed in, for the header and the orders page.
//
// Returns the address rather than a bare boolean: the page says whose orders it
// is showing, and a reader with two addresses needs to be able to tell which one
// they are looking at.

export default defineEventHandler(async (event) => {
  return { signedIn: await readSignedIn(event) }
})
