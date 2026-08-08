// YouFace: a social network that does not exist, for developing against the
// identity challenge without signing into a real one.
//
// Every other route under here sends the reader to a provider and waits for it
// to say who they are. This one skips the trip and makes someone up, so the
// request form, the board, the four-profile allowance and the notification
// emails can be worked on at the speed of clicking a button.
//
// It exists only in dev, twice over: `configuredProviders` never offers it
// outside dev, and the guard below refuses to answer there. Both are deliberate
// — `completeChallenge` stamps `control` by construction, so a YouFace proof is
// indistinguishable from a real sign-in to every rule that leans on one, and a
// single missing fence would be enough to hand out free books.
//
//   /verify/youface?redirect=/give
//   /verify/youface?redirect=/give&name=Mister%20Developer&handle=misterdeveloper
//
// Click it repeatedly to attach several — each click invents a different person,
// so they accumulate up to MAX_ATTACHED rather than replacing one another.

/**
 * Invented people, named so nobody has to work out that they are invented.
 *
 * These end up on the Give board beside real requests, in the same card, with
 * the same badge saying the account was signed into. A plausible name — the
 * first draft of this list had Ada Lovelace and Grace Hopper on it — is a row
 * you have to remember the provenance of. A name that says what it is cannot be
 * misread by whoever opens the board next, screenshots it, or finds the row
 * still sitting there a week later.
 *
 * So: no surnames that look like surnames, and every one legible as a fixture at
 * a glance. Distinct from each other too, since the point is attaching several.
 */
const PEOPLE = [
  { name: 'Mister Developer', handle: 'misterdeveloper' },
  { name: 'Doctor Localhost', handle: 'doctorlocalhost' },
  { name: 'Captain Placeholder', handle: 'captainplaceholder' },
  { name: 'Professor Sample', handle: 'professorsample' },
  { name: 'Agent Fixture', handle: 'agentfixture' },
  { name: 'Sir Not-In-Production', handle: 'notinproduction' },
  { name: 'Madam Test Data', handle: 'madamtestdata' },
  { name: 'Baron Von Stub', handle: 'baronvonstub' }
]

/** Avatar as a data URI: no network, so it works offline and never expires. */
function avatarFor(name: string, hue: number): string {
  const initials = name.split(' ').map(p => p[0]).slice(0, 2).join('')
  const svg
    = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">`
      + `<rect width="96" height="96" fill="hsl(${hue} 65% 45%)"/>`
      + `<text x="48" y="62" font-family="sans-serif" font-size="40" fill="white" `
      + `text-anchor="middle">${initials}</text></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

export default defineEventHandler(async (event) => {
  // Not 403: outside dev this route should look like it was never written,
  // because as far as a deployed site is concerned it wasn't.
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  }

  const query = getQuery(event)

  // A fresh person per click, unless you name one. `subject` is what makes two
  // attachments distinct accounts rather than the same one twice, so it varies
  // even when the name is pinned.
  const pick = PEOPLE[Math.floor(Math.random() * PEOPLE.length)]!
  const name = String(query.name || pick.name)
  const handle = String(query.handle || pick.handle)
  const subject = String(query.subject || `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)

  return completeChallenge(event, {
    provider: 'youface',
    subject,
    name,
    handle,
    // `linkable: false` in the provider metadata, so nothing renders this as a
    // link — there is no youface.example to open.
    avatarUrl: avatarFor(name, (subject.length * 47) % 360),
    // Old enough to look like an account with a history, which is what the
    // board draws attention to.
    accountCreatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 900).toISOString()
  }, `${handle}@youface.invalid`)
})
