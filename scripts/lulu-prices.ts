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
import { catalog, formatPrice, SPONSOR_SHIPPING_CENTS } from '../shared/catalog.ts'

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
  total_cost_excl_tax?: string
  total_cost_incl_tax?: string
  total_tax?: string
  shipping_cost?: { total_cost_excl_tax?: string, total_cost_incl_tax?: string }
  fulfillment_cost?: { total_cost_excl_tax?: string }
  line_item_costs?: {
    total_cost_excl_tax?: string
    total_cost_incl_tax?: string
    /** Per-copy print cost, excl. tax — what a catalog price has to cover. */
    unit_tier_cost?: string
  }[]
}

// Everything below is excl. tax on purpose. Lulu's tax is the destination's
// sales tax on this quote, not a cost of the book: a Springfield address adds
// 10.25% that an Oregon one doesn't. Comparing a tax-inclusive quote against
// `priceCents` measures Illinois, not margin.
interface Quote {
  slug: string
  title: string
  pageCount: number
  currency: string
  /** Print cost per copy, excl. tax. */
  print?: number
  /** Lulu's per-order fulfilment fee, excl. tax — charged once, not per copy. */
  fulfillment?: number
  /** Shipping for the whole (single-title) order, excl. tax. */
  shipping?: number
  /** Destination sales tax on the whole quote — varies by address. */
  tax?: number
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

    // The mock carries no tax, so its incl-tax fields stand in for excl-tax.
    const shipping = money(res.shipping_cost?.total_cost_excl_tax)
      ?? money(res.shipping_cost?.total_cost_incl_tax)
    const fulfillment = money(res.fulfillment_cost?.total_cost_excl_tax)
    const total = money(res.total_cost_excl_tax) ?? money(res.total_cost_incl_tax)
    const tax = money(res.total_tax)
    // Real Lulu gives a per-copy figure directly; the mock answers with a total
    // and nothing itemised, so fall back to dividing the line total.
    const lineTotal = money(res.line_item_costs?.[0]?.total_cost_excl_tax)
      ?? money(res.line_item_costs?.[0]?.total_cost_incl_tax)
    const print = money(res.line_item_costs?.[0]?.unit_tier_cost)
      ?? (lineTotal !== undefined ? lineTotal / quantity : undefined)
      ?? (total !== undefined && shipping !== undefined ? (total - shipping) / quantity : undefined)

    return { ...base, currency: res.currency || 'USD', print, fulfillment, shipping, tax, total }
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

console.log(`${pad('title', 32)}${'pages'.padStart(6)}${'print/ea'.padStart(10)}${'fulfil'.padStart(9)}${'ship'.padStart(9)}${'total'.padStart(9)}${'catalog'.padStart(10)}`)
console.log('─'.repeat(85))

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
    + dollars(q.fulfillment).padStart(9)
    + dollars(q.shipping).padStart(9)
    + dollars(q.total).padStart(9)
    + formatPrice(book.priceCents, book.currency).padStart(10)
    + (mocked ? '   (MOCK)' : '')
  )
}

console.log('\nAll figures exclude tax. Lulu adds the destination\'s sales tax on top')
console.log('(this quote: ' + dollars(quotes.find(q => q.tax !== undefined)?.tax) + '), which is the buyer\'s, not a cost of the book.')

const priced = quotes.filter(q => q.print !== undefined)
if (priced.length > 0) {
  console.log(`\nAs catalog \`priceCents\` — print grossed up for Stripe's 2.9%:\n`)
  for (const q of priced) {
    const book = catalog.find(b => b.slug === q.slug)!
    // Must match the rule documented above `catalog` in shared/catalog.ts: a
    // price carries printing alone. Lulu's per-order fulfilment fee, Stripe's
    // fixed 30¢ and the postage all ride on the shipping line instead.
    const perCopy = Math.ceil(q.print! * 100 / 0.971)
    const note = perCopy === book.priceCents
      ? 'unchanged'
      : `now ${book.priceCents}, ${perCopy > book.priceCents ? 'under-priced by' : 'over-priced by'} ${formatPrice(Math.abs(perCopy - book.priceCents))}`
    console.log(`  ${pad(q.slug, 30)} priceCents: ${String(perCopy).padStart(5)}   (${note})`)
  }
  const fulfillment = priced.find(q => q.fulfillment !== undefined)?.fulfillment
  console.log(`\n  Bare print cost is the floor, not the price: Lulu also bills ${dollars(fulfillment)}`)
  console.log('  fulfilment per order plus postage, and Stripe keeps 2.9% + 30¢ of every')
  console.log('  charge. The per-order parts are recovered on the shipping line, so these')
  console.log('  figures need only survive the percentage.')
}

const shipping = priced.find(q => q.shipping !== undefined)?.shipping
if (shipping !== undefined) {
  console.log(`\nShipping quoted at ${dollars(shipping)} for ${quantity} cop${quantity === 1 ? 'y' : 'ies'}, to this address at`)
  console.log(`${level}. It scales with the order and with where it is going. The site charges:`)
  console.log('  cart checkout      quoted live per cart, per region   server/utils/shipping.ts')
  console.log(`  sponsored request  flat ${formatPrice(SPONSOR_SHIPPING_CENTS)}                        shared/catalog.ts`)
  console.log('  Re-run with --level, --country and --qty to check a region\'s reference')
  console.log('  address, or to see how far the sponsor flat rate has drifted.')
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
