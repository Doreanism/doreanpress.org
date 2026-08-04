// What Lulu actually charges to print each title in the catalog.
//
//   npm run lulu:prices
//   npm run lulu:prices -- --country=GB --postcode=SW1A1AA --level=GROUND
//
// The catalog's `priceCents` are hand-typed. This asks Lulu what a copy really
// costs, so the numbers in `shared/catalog.ts` can be replaced with real ones.
// It only reads — nothing is written and no print job is created.
//
// It runs the site's own Lulu client (`server/utils/lulu.ts`) rather than a
// second copy of the same calls, so a quote that works here is a quote the
// server can make too. That client expects Nitro's auto-imports, which a plain
// node process doesn't have, hence the two globals below.

import { ofetch } from 'ofetch'
import { catalog, formatPrice } from '../shared/catalog.ts'

const args = new Map(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map((a) => {
      const [key, ...rest] = a.slice(2).split('=')
      return [key!, rest.join('=') || 'true'] as const
    })
)

const arg = (name: string, fallback = '') => args.get(name) ?? fallback

Object.assign(globalThis, {
  $fetch: ofetch,
  useRuntimeConfig: () => ({
    lulu: {
      clientKey: process.env.NUXT_LULU_CLIENT_KEY || '',
      clientSecret: process.env.NUXT_LULU_CLIENT_SECRET || '',
      baseUrl: process.env.NUXT_LULU_BASE_URL || 'https://api.sandbox.lulu.com',
      contactEmail: process.env.NUXT_LULU_CONTACT_EMAIL || '',
      mock: process.env.NUXT_LULU_MOCK ?? 'true'
    }
  })
})

const { calculatePrintCost, isLuluMocked } = await import('../server/utils/lulu.ts')
type ShippingLevel = Parameters<typeof calculatePrintCost>[0]['shippingLevel']

// A quote needs somewhere to ship to: print cost is flat, but shipping and tax
// are not, so every figure below is only true for this destination.
const country = arg('country', 'US').toUpperCase()
const address = {
  name: 'Dorean Press',
  street1: arg('street', '1 Main Street'),
  city: arg('city', country === 'US' ? 'Springfield' : 'London'),
  state_code: country === 'US' ? arg('state', 'IL') : args.get('state'),
  postcode: arg('postcode', country === 'US' ? '62701' : 'SW1A 1AA'),
  country_code: country,
  phone_number: arg('phone', '+1 555 555 5555')
}

const level = arg('level', 'MAIL').toUpperCase() as ShippingLevel
const quantity = Math.max(1, Math.floor(Number(arg('qty', '1'))) || 1)
const only = args.get('slug')
const books = only ? catalog.filter(b => b.slug === only) : catalog

if (books.length === 0) {
  console.error(`No catalog title with slug '${only}'.`)
  process.exit(1)
}

const mocked = isLuluMocked()
if (mocked) {
  console.warn([
    '',
    '  ┌─────────────────────────────────────────────────────────────────┐',
    '  │  MOCK MODE — these are invented numbers, not Lulu\'s.            │',
    '  │  Do not paste them into the catalog.                            │',
    '  │  Set NUXT_LULU_CLIENT_KEY, NUXT_LULU_CLIENT_SECRET and          │',
    '  │  NUXT_LULU_MOCK=false in .env for real quotes.                  │',
    '  └─────────────────────────────────────────────────────────────────┘'
  ].join('\n'))
}

/** Money off the Lulu response: strings like '4.53', or absent. */
function money(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

const dollars = (n: number | undefined) => n === undefined ? '—' : `$${n.toFixed(2)}`
const pad = (s: string, width: number) => s.length > width ? `${s.slice(0, width - 1)}…` : s.padEnd(width)

/** The slice of Lulu's cost-calculation response this script reads. */
interface CostResponse {
  currency?: string
  total_cost_incl_tax?: string
  shipping_cost?: { total_cost_incl_tax?: string }
  line_item_costs?: { total_cost_incl_tax?: string }[]
}

interface Quote {
  slug: string
  title: string
  pageCount: number
  currency: string
  /** Print cost for `quantity` copies, incl. tax. */
  print?: number
  /** Shipping for the whole (single-title) order, incl. tax. */
  shipping?: number
  total?: number
  error?: string
}

async function quote(book: typeof catalog[number]): Promise<Quote> {
  const base = { slug: book.slug, title: book.title, pageCount: book.lulu.pageCount, currency: 'USD' }
  try {
    const res = await calculatePrintCost({
      lineItems: [{
        podPackageId: book.lulu.podPackageId,
        pageCount: book.lulu.pageCount,
        quantity
      }],
      shippingAddress: address,
      shippingLevel: level
    }) as CostResponse

    const shipping = money(res.shipping_cost?.total_cost_incl_tax)
    const total = money(res.total_cost_incl_tax)
    // The mock answers with a total and nothing itemised; real Lulu itemises.
    const print = money(res.line_item_costs?.[0]?.total_cost_incl_tax)
      ?? (total !== undefined && shipping !== undefined ? total - shipping : undefined)

    return { ...base, currency: res.currency || 'USD', print, shipping, total }
  } catch (err) {
    // ofetch hangs Lulu's own explanation (bad pod package id, page count out of
    // range for the binding) on `.data` — far more useful than the status line.
    const detail = (err as { data?: unknown }).data
    return {
      ...base,
      error: detail ? JSON.stringify(detail) : err instanceof Error ? err.message : String(err)
    }
  }
}

const shipTo = [address.city, address.state_code, address.postcode, country].filter(Boolean).join(' ')
console.log(`\nLulu quotes — ${quantity} cop${quantity === 1 ? 'y' : 'ies'} per title, ${level}, to ${shipTo}`)
console.log(`${(process.env.NUXT_LULU_BASE_URL || 'https://api.sandbox.lulu.com')}\n`)

const quotes: Quote[] = []
for (const book of books) {
  quotes.push(await quote(book))
}

console.log(`${pad('title', 32)}${'pages'.padStart(6)}${'print'.padStart(10)}${'ship'.padStart(9)}${'total'.padStart(9)}${'catalog'.padStart(10)}`)
console.log('─'.repeat(76))

for (const q of quotes) {
  const book = catalog.find(b => b.slug === q.slug)!
  if (q.error) {
    console.log(`${pad(q.title, 32)}${String(q.pageCount).padStart(6)}   ${q.error}`)
    continue
  }
  console.log(
    pad(q.title, 32)
    + String(q.pageCount).padStart(6)
    + dollars(q.print).padStart(10)
    + dollars(q.shipping).padStart(9)
    + dollars(q.total).padStart(9)
    + formatPrice(book.priceCents, book.currency).padStart(10)
    + (mocked ? '   (MOCK)' : '')
  )
}

const priced = quotes.filter(q => q.print !== undefined)
if (priced.length > 0) {
  console.log(`\nPrint cost per copy, as catalog \`priceCents\` — shipping is charged separately:\n`)
  for (const q of priced) {
    const book = catalog.find(b => b.slug === q.slug)!
    const perCopy = Math.ceil((q.print! / quantity) * 100)
    const note = perCopy === book.priceCents
      ? 'unchanged'
      : `now ${book.priceCents}, ${perCopy > book.priceCents ? 'under-priced by' : 'over-priced by'} ${formatPrice(Math.abs(perCopy - book.priceCents))}`
    console.log(`  ${pad(q.slug, 30)} priceCents: ${String(perCopy).padStart(5)}   (${note})`)
  }
  console.log('\n  At cost is the floor, not the price: Stripe keeps roughly 2.9% + 30¢ of')
  console.log('  every charge, so a book sold at exactly this loses money on each sale.')
}

const shipping = priced.find(q => q.shipping !== undefined)?.shipping
if (shipping !== undefined) {
  console.log(`\nShipping quoted at ${dollars(shipping)} for this order. The site charges flat rates:`)
  console.log('  $4.99 standard / $12.99 expedited   server/api/checkout.post.ts')
  console.log('  $4.99 per sponsored request         shared/catalog.ts SPONSOR_SHIPPING_CENTS')
  console.log('  Re-run with --level and --country to see how far those drift.')
}

if (args.has('json')) {
  console.log(`\n${JSON.stringify(quotes, null, 2)}`)
}

const failed = quotes.filter(q => q.error)
if (failed.length > 0) {
  console.error(`\n${failed.length} of ${quotes.length} titles could not be quoted.`)
  process.exit(1)
}
if (mocked) {
  console.warn('\nMock mode — nothing above came from Lulu.')
}
console.log('')
