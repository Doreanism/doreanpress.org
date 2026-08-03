import { describe, expect, it } from 'vitest'
import { lookupAccount, normalizeAccount } from '../server/utils/accountLookup'

// Everything here is reached without a network call: `normalizeAccount` is pure,
// and every case below is one the adapters reject on shape before they would
// fetch anything. That is deliberate — the rejections are the part worth pinning
// down, and a test that hit GitHub would be measuring GitHub's uptime.

describe('normalizeAccount', () => {
  it('drops a leading @, which readers type out of habit', () => {
    expect(normalizeAccount('github', '@torvalds')).toBe('torvalds')
    expect(normalizeAccount('bluesky', '@alice.bsky.social')).toBe('alice.bsky.social')
  })

  it('takes the account out of a pasted profile link', () => {
    expect(normalizeAccount('github', 'https://github.com/torvalds')).toBe('torvalds')
    expect(normalizeAccount('bluesky', 'https://bsky.app/profile/alice.bsky.social'))
      .toBe('alice.bsky.social')
  })

  it('survives the trailing slash and query string a real paste carries', () => {
    expect(normalizeAccount('github', 'https://github.com/torvalds/?tab=repositories'))
      .toBe('torvalds')
  })

  // A Mastodon account is only meaningful with its server, and the server is
  // the half a pasted URL keeps somewhere other than the last path segment.
  it('keeps the server when a Mastodon profile link is pasted', () => {
    expect(normalizeAccount('mastodon', 'https://mastodon.social/@Gargron'))
      .toBe('Gargron@mastodon.social')
  })

  it('leaves an already-typed Mastodon address alone', () => {
    expect(normalizeAccount('mastodon', '@Gargron@mastodon.social'))
      .toBe('Gargron@mastodon.social')
  })

  it('takes the account out of a GitLab profile link', () => {
    expect(normalizeAccount('gitlab', 'https://gitlab.com/alice')).toBe('alice')
    expect(normalizeAccount('gitlab', 'https://gitlab.com/alice/')).toBe('alice')
  })

  it('yields nothing from a profile link with no profile on it', () => {
    expect(normalizeAccount('github', 'https://github.com/')).toBe('')
  })

  // Malformed input is left as typed rather than thrown over: it fails the
  // provider's own shape check a moment later, which is the same answer by a
  // calmer route.
  it('does not throw on something that only looks like a URL', async () => {
    expect(() => normalizeAccount('github', 'https://')).not.toThrow()
    expect(await lookupAccount('github', 'https://')).toEqual({ status: 'missing' })
  })
})

describe('lookupAccount', () => {
  it('refuses a provider that has no public lookup', async () => {
    // These five can only be proved, never looked up.
    for (const provider of ['x', 'facebook', 'linkedin', 'twitch', 'tiktok', 'nonsense']) {
      expect(await lookupAccount(provider, 'someone')).toEqual({ status: 'unsupported' })
    }
  })

  it('treats an empty account as not found rather than calling out', async () => {
    expect(await lookupAccount('github', '   ')).toEqual({ status: 'missing' })
  })

  it('rejects usernames that cannot exist at the provider', async () => {
    // Rejected on shape, so an obvious typo never becomes an outbound request.
    expect(await lookupAccount('github', 'not a username')).toEqual({ status: 'missing' })
    expect(await lookupAccount('github', '-leading-hyphen')).toEqual({ status: 'missing' })
    expect(await lookupAccount('bluesky', 'nodotshere')).toEqual({ status: 'missing' })
    expect(await lookupAccount('mastodon', 'noserver')).toEqual({ status: 'missing' })
    expect(await lookupAccount('mastodon', 'too@many@ats')).toEqual({ status: 'missing' })
    expect(await lookupAccount('gitlab', 'not a username')).toEqual({ status: 'missing' })
    expect(await lookupAccount('gitlab', '-leading-hyphen')).toEqual({ status: 'missing' })
  })

  // Mastodon is the one provider whose *host* comes from the reader, so this is
  // the one lookup that could be aimed at our own network. Each of these must
  // be refused before any request leaves the process.
  it('refuses to fetch a Mastodon server that is not a public domain', async () => {
    const targets = [
      'user@localhost',
      'user@127.0.0.1',
      'user@169.254.169.254',
      'user@10.0.0.5',
      'user@metadata.internal',
      'user@box.local',
      'user@server',
      'user@.leadingdot.social',
      'user@trailing-.social'
    ]
    for (const target of targets) {
      expect(await lookupAccount('mastodon', target), target).toEqual({ status: 'missing' })
    }
  })
})
