import { afterEach, expect, it, vi } from 'vitest'
import { requireAdministrator } from '../server/utils/ministry'

afterEach(() => vi.unstubAllGlobals())

function setup(account: object | null, roles: object[]) {
  vi.stubGlobal('readSignedIn', async () => account)
  vi.stubGlobal('ensureRequestsSchema', async () => {})
  const sql = async (strings: TemplateStringsArray) => strings.join('').includes('SELECT role') ? roles : []
  vi.stubGlobal('db', () => Object.assign(sql, { transaction: (queries: Promise<unknown>[]) => Promise.all(queries) }))
  vi.stubGlobal('setResponseHeader', vi.fn())
  vi.stubGlobal('createError', (input: object) => Object.assign(new Error(), input))
}

it('accepts an active admin session even when the original sign-in is old', async () => {
  const account = { accountId: 'admin', at: '2020-01-01T00:00:00Z' }
  setup(account, [{ role: 'fulfillment_admin' }])
  expect(await requireAdministrator({} as never)).toEqual(account)
})
it('still requires sign-in', async () => {
  setup(null, [])
  await expect(requireAdministrator({} as never)).rejects.toMatchObject({ statusCode: 401 })
})
it('still rejects non-admin accounts', async () => {
  setup({ accountId: 'reader', at: new Date().toISOString() }, [])
  await expect(requireAdministrator({} as never)).rejects.toMatchObject({ statusCode: 403 })
})

it('shares checks inside one request but checks revocation on the next request', async () => {
  const roles = [{ role: 'fulfillment_admin' }]
  setup({ accountId: 'admin', at: '2020-01-01T00:00:00Z' }, roles)
  const event = {} as never
  const [first, second] = await Promise.all([requireAdministrator(event), requireAdministrator(event)])
  expect(first).toBe(second)
  roles.length = 0
  await expect(requireAdministrator({} as never)).rejects.toMatchObject({ statusCode: 403 })
})
