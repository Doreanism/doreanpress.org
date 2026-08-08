import { afterEach, describe, expect, it, vi } from 'vitest'

// The Lulu client is mocked at the module boundary: importing it for real would
// want Nitro's `useRuntimeConfig` and then the network. Each test hands back the
// shape Lulu really answers with, so the arithmetic is tested without either.
const { printCost } = vi.hoisted(() => ({ printCost: vi.fn() }))
vi.mock('../server/utils/lulu', () => ({ calculatePrintCost: printCost }))

function withQuote(shippingExclTax: string | undefined, opts: { throws?: boolean } = {}) {
  printCost.mockReset()
  printCost.mockImplementation(async () => {
    if (opts.throws) throw new Error('lulu is having a bad minute')
    return { shipping_cost: { total_cost_excl_tax: shippingExclTax } }
  })
  return printCost
}

const {
  SHIPPING_REGIONS,
  SHIPPING_COUNTRIES,
  quoteShippingCents,
  quoteRegionOptions
} = await import('../server/utils/shipping')

const CART = [{ podPackageId: '0600X0900BWSTDPB060UW444GXX', pageCount: 220, quantity: 1 }]
const US = { city: 'Springfield', stateCode: 'IL', postcode: '62701', countryCode: 'US' }

afterEach(() => printCost.mockReset())

describe('quoteShippingCents', () => {
  it('adds the per-order fees and grosses up for Stripe, so the press nets Lulu whole', async () => {
    withQuote('5.69')
    // (5.69 + 0.75 fulfilment + 0.30 Stripe fixed) / 0.971 = 6.9413 -> 695c
    const cents = await quoteShippingCents(CART, US)
    expect(cents).toBe(695)

    // What the reader pays, less Stripe's percentage, must still cover Lulu.
    const net = (cents! / 100) * 0.971
    expect(net).toBeGreaterThanOrEqual(5.69 + 0.75 + 0.30 * 0.971)
  })

  it('never charges less than Lulu bills, across the quantities Lulu quoted', async () => {
    // Real MAIL quotes for a 220pp 6x9 to a US address.
    for (const [qty, ship] of [[1, 5.69], [2, 6.94], [3, 7.69], [5, 9.69], [10, 13.44]] as const) {
      withQuote(String(ship))
      const cents = await quoteShippingCents([{ ...CART[0]!, quantity: qty }], US)
      const netOfStripe = (cents! / 100) * 0.971 - 0.30
      expect(netOfStripe).toBeGreaterThanOrEqual(ship + 0.75 - 0.005)
    }
  })

  it('passes the destination through rather than always quoting one address', async () => {
    const spy = withQuote('11.24')
    await quoteShippingCents(CART, { city: 'Oslo', postcode: '0150', countryCode: 'NO' })
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      shippingAddress: expect.objectContaining({ city: 'Oslo', country_code: 'NO' })
    }))
  })

  it('returns null rather than throwing when Lulu is unreachable', async () => {
    withQuote(undefined, { throws: true })
    expect(await quoteShippingCents(CART, US)).toBeNull()
  })

  it('returns null when Lulu answers without a shipping figure', async () => {
    withQuote(undefined)
    expect(await quoteShippingCents(CART, US)).toBeNull()
  })
})

describe('quoteRegionOptions', () => {
  it('prices every region, and says the numbers came from Lulu', async () => {
    withQuote('5.69')
    const options = await quoteRegionOptions(CART)
    expect(options).toHaveLength(SHIPPING_REGIONS.length)
    expect(options.every(o => o.quoted)).toBe(true)
    expect(options.every(o => o.amountCents === 695)).toBe(true)
  })

  it('falls back to the stored rate instead of leaving checkout with no option', async () => {
    withQuote(undefined, { throws: true })
    const options = await quoteRegionOptions(CART)
    expect(options.every(o => !o.quoted)).toBe(true)
    for (const option of options) {
      expect(option.amountCents).toBe(option.region.fallbackCents)
    }
  })
})

describe('shipping regions', () => {
  it('quotes each region against an address inside it', async () => {
    for (const region of SHIPPING_REGIONS) {
      expect(region.countries).toContain(region.reference.countryCode)
    }
  })

  it('offers every country Stripe collects an address for', async () => {
    for (const country of SHIPPING_COUNTRIES) {
      expect(SHIPPING_REGIONS.some(r => r.countries.includes(country))).toBe(true)
    }
    expect(SHIPPING_COUNTRIES).toHaveLength(new Set(SHIPPING_COUNTRIES).size)
  })

  it('gives each option a distinct label, since the webhook reads it back', async () => {
    // `fulfillOrder` maps the chosen rate's display_name to a Lulu shipping
    // level. Two regions sharing a label would post one of them at the wrong
    // speed, at the press's expense.
    const labels = SHIPPING_REGIONS.map(r => r.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('stays within the five shipping options Stripe Checkout accepts', async () => {
    expect(SHIPPING_REGIONS.length).toBeLessThanOrEqual(5)
  })

  it('sets every fallback above the region\'s dearest observed destination', async () => {
    // Grossed-up floors from the 2026-08-08 quotes recorded in shipping.ts.
    const dearest: Record<string, number> = {
      'us-standard': 7.69,
      'us-expedited': 20.74,
      'canada': 10.92,
      'europe': 11.24,
      'oceania': 11.93
    }
    for (const region of SHIPPING_REGIONS) {
      const floor = Math.ceil((dearest[region.id]! * 100 + 105) / 0.971)
      expect(region.fallbackCents).toBeGreaterThanOrEqual(floor)
    }
  })
})
