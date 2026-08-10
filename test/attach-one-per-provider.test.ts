// One profile per provider, and the neighbour it must not touch.
//
// `issueProof` is the single place a proof is minted, so the rule that a set
// carries at most one account per provider lives there and nowhere else. These
// tests are about that rule and its blast radius, not about Postgres: the
// database and the session are stubbed, and what is asserted is which proofs
// survive and which ids get burned.
//
// The second test is the point of the file. The earliest version of this code
// burned the old proof on *every* check, which silently dropped an account the
// reader had attached a moment before — so a rule that burns on some checks is
// one careless predicate away from that bug, and the difference between "burns
// what it supersedes" and "burns the lot" is exactly what needs pinning down.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_ATTACHED, type IdentityProof, type IdentityProvider } from '../shared/identity'

/**
 * Stand-in for the `neon` tagged-template client, recording what it was asked.
 *
 * Matched on a fragment rather than a positional queue, for the reason
 * `signin.test.ts` gives: this path also creates a table and prunes, and a queue
 * feeds the schema statement the row meant for the query under test.
 */
function stubDb() {
  const burned: string[] = []
  const sql = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const text = strings.join('?')
    if (text.includes('INSERT INTO spent_proofs')) burned.push(String(values[0]))
    // Nothing is spent unless this test burned it — the proofs under test are live.
    if (text.includes('SELECT 1 FROM spent_proofs')) {
      return Promise.resolve(burned.includes(String(values[0])) ? [{ '?column?': 1 }] : [])
    }
    return Promise.resolve([])
  }
  vi.stubGlobal('db', () => sql)
  return { burned }
}

/** A live, signed-in proof — the only kind `readProofs` honours. */
function proof(provider: IdentityProvider, subject: string): IdentityProof {
  return {
    id: `${provider}-${subject}`,
    identity: {
      provider,
      subject,
      name: `${subject} on ${provider}`,
      confirmation: 'control',
      verifiedAt: new Date().toISOString()
    }
  }
}

/** What is being attached, before `issueProof` stamps it. */
function incoming(provider: IdentityProvider, subject: string) {
  return {
    provider,
    subject,
    name: `${subject} on ${provider}`,
    confirmation: 'control' as const
  }
}

let session: { proofs?: IdentityProof[] }
let db: ReturnType<typeof stubDb>

beforeEach(() => {
  session = { proofs: [] }
  db = stubDb()
  vi.stubGlobal('getUserSession', async () => session)
  vi.stubGlobal('replaceUserSession', async (_e: unknown, data: { proofs: IdentityProof[] }) => {
    session = data
  })
  vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string, data?: unknown }) => {
    const err = new Error(input.statusMessage) as Error & { statusCode?: number, data?: unknown }
    err.statusCode = input.statusCode
    err.data = input.data
    return err
  })
})

afterEach(() => vi.unstubAllGlobals())

const { issueProof } = await import('../server/utils/identityProof')

/** Who is attached now, as `provider:subject`, in the order held. */
const attached = () => (session.proofs ?? []).map(p => `${p.identity.provider}:${p.identity.subject}`)

describe('one profile per provider', () => {
  it('replaces the account already held at that provider', async () => {
    session = { proofs: [proof('x', 'first')] }

    await issueProof({} as never, incoming('x', 'second'))

    expect(attached()).toEqual(['x:second'])
  })

  it('burns the proof it replaced, so the stale id stops opening doors', async () => {
    session = { proofs: [proof('x', 'first')] }

    await issueProof({} as never, incoming('x', 'second'))

    expect(db.burned).toEqual(['x-first'])
  })

  // The one that guards the old bug.
  it('leaves accounts at other providers alone', async () => {
    session = {
      proofs: [proof('github', 'octo'), proof('x', 'first'), proof('linkedin', 'someone')]
    }

    await issueProof({} as never, incoming('x', 'second'))

    expect(attached()).toEqual(['github:octo', 'linkedin:someone', 'x:second'])
    expect(db.burned).toEqual(['x-first'])
    expect(db.burned).not.toContain('github-octo')
    expect(db.burned).not.toContain('linkedin-someone')
  })

  it('still accumulates across different providers', async () => {
    session = { proofs: [proof('x', 'first')] }

    await issueProof({} as never, incoming('github', 'octo'))

    expect(attached()).toEqual(['x:first', 'github:octo'])
    expect(db.burned).toEqual([])
  })

  // A cookie sealed before this rule existed can still hold a pair for its
  // twenty minutes. Both have to go, or the spare stays spendable.
  it('clears every account held at that provider, not just the first', async () => {
    session = { proofs: [proof('x', 'one'), proof('x', 'two'), proof('github', 'octo')] }

    await issueProof({} as never, incoming('x', 'three'))

    expect(attached()).toEqual(['github:octo', 'x:three'])
    expect(db.burned).toEqual(['x-one', 'x-two'])
  })
})

describe('the ceiling, now that it counts services', () => {
  const fourProviders: IdentityProvider[] = ['x', 'facebook', 'linkedin', 'github']

  it(`refuses a ${MAX_ATTACHED + 1}th provider`, async () => {
    session = { proofs: fourProviders.map(p => proof(p, 'held')) }

    await expect(issueProof({} as never, incoming('gitlab', 'new')))
      .rejects.toMatchObject({ data: { limit: true } })
  })

  // Replacing is not adding, so it is allowed at the ceiling — which is the
  // only way a full reader can swap a wrong account for the right one.
  it('allows a replacement at the ceiling', async () => {
    session = { proofs: fourProviders.map(p => proof(p, 'held')) }

    await issueProof({} as never, incoming('x', 'corrected'))

    expect(attached()).toContain('x:corrected')
    expect(session.proofs).toHaveLength(MAX_ATTACHED)
  })
})
