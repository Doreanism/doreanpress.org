import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RequesterIdentity } from '../shared/identity'

const attachIdentity = vi.fn()
const listAttachedIdentities = vi.fn()
const detachIdentity = vi.fn()

vi.mock('../server/utils/readerAccounts', () => ({
  attachIdentity,
  listAttachedIdentities,
  detachIdentity
}))

const replaced: Record<string, unknown>[] = []
vi.stubGlobal('replaceUserSession', async (_event: unknown, value: Record<string, unknown>) => {
  replaced.push(value)
})
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) =>
  Object.assign(new Error(input.statusMessage), input))

const { discardProofs, issueProof, readProofs, requireProofs } = await import('../server/utils/identityProof')

function identity(provider: RequesterIdentity['provider'], subject: string): RequesterIdentity {
  return {
    provider,
    subject,
    name: `${subject} on ${provider}`,
    confirmation: 'control',
    verifiedAt: '2026-09-19T00:00:00.000Z'
  }
}

beforeEach(() => {
  replaced.length = 0
  attachIdentity.mockReset().mockResolvedValue({
    accountId: 'reader-1',
    label: '@reader',
    at: '2026-09-19T00:00:00.000Z'
  })
  listAttachedIdentities.mockReset().mockResolvedValue({ identities: [] })
  detachIdentity.mockReset().mockResolvedValue(undefined)
})

afterEach(() => vi.clearAllMocks())

describe('database-backed attached identities', () => {
  it('stores only an opaque account id and compact sign-in in the cookie', async () => {
    await issueProof({} as never, {
      provider: 'github',
      subject: '42',
      name: 'Reader',
      confirmation: 'control'
    })

    expect(attachIdentity).toHaveBeenCalledOnce()
    expect(replaced).toEqual([{
      accountId: 'reader-1',
      signedIn: {
        accountId: 'reader-1',
        label: '@reader',
        at: '2026-09-19T00:00:00.000Z'
      }
    }])
    expect(JSON.stringify(replaced)).not.toContain('github')
  })

  it('reads every identity without a total or per-provider ceiling', async () => {
    const identities = [
      identity('x', '1'),
      identity('x', '2'),
      identity('facebook', '3'),
      identity('linkedin', '4'),
      identity('github', '5'),
      identity('gitlab', '6')
    ]
    listAttachedIdentities.mockResolvedValue({ identities, email: 'reader@example.com' })

    const proofs = await readProofs({} as never)
    expect(proofs).toHaveLength(6)
    expect(proofs.map(proof => proof.identity.provider)).toEqual(
      ['x', 'x', 'facebook', 'linkedin', 'github', 'gitlab']
    )
  })

  it('still requires at least one public identity for a request', async () => {
    await expect(requireProofs({} as never, 'asking for a book'))
      .rejects.toMatchObject({ statusCode: 401 })
  })

  it('deletes a provider link from the durable account', async () => {
    await discardProofs({} as never, 'bluesky:did:plc:reader')
    expect(detachIdentity).toHaveBeenCalledWith({}, 'bluesky:did:plc:reader')
  })
})
