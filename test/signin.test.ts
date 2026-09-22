import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeEmail, issueLoginLink, consumeLoginLink } from '../server/utils/loginLink'
import { loginOrigin, loginReturnPath } from '../shared/login'

afterEach(() => vi.unstubAllGlobals())
function stubDb(rows: unknown[] = []) {
  vi.stubGlobal('db', () => (strings: TemplateStringsArray) =>
    Promise.resolve(strings.join('').includes('RETURNING') ? rows : []))
}

describe('email login links', () => {
  it('normalizes inbox addresses', () => {
    expect(normalizeEmail(' Reader@Example.COM ')).toBe('reader@example.com')
  })
  it('issues a high-entropy token only when a send is permitted', async () => {
    stubDb([{ email: 'reader@example.com' }])
    expect(await issueLoginLink('reader@example.com')).toMatch(/^[a-f0-9]{64}$/)
    stubDb()
    expect(await issueLoginLink('reader@example.com')).toBeNull()
  })
  it('requires the database to consume the token', async () => {
    stubDb([{ email: 'reader@example.com', return_path: '/profiles' }])
    expect(await consumeLoginLink('a'.repeat(64))).toEqual({ email: 'reader@example.com', redirect: '/profiles' })
    stubDb()
    expect(await consumeLoginLink('a'.repeat(64))).toBeNull()
  })
  it('rejects codes and malformed tokens', async () => {
    stubDb([{ email: 'reader@example.com' }])
    expect(await consumeLoginLink('123456')).toBeNull()
  })
  it('uses the actual localhost port only in development', () => {
    expect(loginOrigin('http://localhost:3107/api/auth/request-link', 'https://doreanpress.org', true)).toBe('http://localhost:3107')
    expect(loginOrigin('http://evil.example/path', 'https://doreanpress.org', true)).toBe('https://doreanpress.org')
    expect(loginOrigin('http://localhost:3107/path', 'https://doreanpress.org', false)).toBe('https://doreanpress.org')
  })
  it('rejects external and disguised return URLs', () => {
    for (const path of ['https://evil.example', '//evil.example', '/%2fevil.example', '/%5cevil.example', '/ /evil.example', '/account/confirm']) {
      expect(loginReturnPath(path)).toBe('/account')
    }
    expect(loginReturnPath('/catalog/book?request=1')).toBe('/catalog/book?request=1')
  })
})
