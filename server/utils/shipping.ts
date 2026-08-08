// What it really costs to get a parcel to a reader, asked of Lulu rather than
// guessed.
//
// Stripe Checkout is the awkward part: it fixes the shipping options before it
// collects the address, so at the moment this runs we do not know where the
// books are going. The reader picks their own region instead, and each option
// is a live Lulu quote for the actual cart against a reference address in that
// region.
//
// Reference addresses are deliberately *typical* for their region, not worst
// case. Quoting the worst would mean no order ever loses money, at the price of
// over-charging everyone else — which is a markup wearing a different hat, and
// the opposite of what this press is for. So the common case pays cost exactly
// and the press absorbs the tail. Quoted from api.lulu.com on 2026-08-08, one
// 220pp 6x9 copy, MAIL, in USD:
//
//   US    mainland 5.69 · AK/HI 7.69
//   CA    Toronto 10.92
//   EU    GB 5.22 · DE 7.04 · NL 7.76 · IT 8.36 · ES 8.87 · AT/BE/DK/FI/PL/PT/SE 9.32
//         FR 9.83 · IE 10.16 · CH 10.28 · NO 11.24
//   AU/NZ AU 8.34 · NZ 11.93
//
// The known tails, all rare relative to their region: Alaska and Hawaii run
// about $2 over the mainland quote, Britain runs about $4 under the European
// one (Lulu prints in the UK, so a UK parcel never crosses a border), and New
// Zealand about $3.60 over the Australian one.
import { calculatePrintCost, type ShippingLevel } from './lulu'

/**
 * What a quote needs to know about a copy — trim size, extent and how many.
 * Deliberately narrower than `LuluLineItem`: costing a parcel does not require
 * the print-ready PDFs that actually printing it does.
 */
export interface PrintQuoteItem {
  podPackageId: string
  pageCount: number
  quantity: number
}

/**
 * Stripe's percentage cut. Shipping is charged on top of the books, and Stripe
 * takes its 2.9% of that too, so an option priced at Lulu's bare quote arrives
 * ~3% short. Divide by this to hand over exactly what Lulu billed.
 */
const STRIPE_RATE = 0.971

/**
 * Stripe's fixed 30c, plus Lulu's 75c per-order fulfilment fee. Both are levied
 * once per order rather than per copy, which is exactly what a shipping line is,
 * so they ride here instead of being smeared across the book prices.
 */
const PER_ORDER_CENTS = 105

export interface ShippingRegion {
  id: string
  /** Shown to the reader in Stripe Checkout — they choose by it, so name places. */
  label: string
  /** ISO country codes this option is meant to cover. */
  countries: string[]
  /** A typical destination in the region; the quote is taken against this. */
  reference: {
    city: string
    stateCode?: string
    postcode: string
    countryCode: string
  }
  level: ShippingLevel
  /** Days shown alongside the price, from Lulu's published MAIL/EXPEDITED ranges. */
  businessDays: { min: number, max: number }
  /**
   * Used only if Lulu cannot be reached. Set from the region's dearest observed
   * destination, grossed up — erring high here means a failed quote never
   * silently sells at a loss, and the alternative (no shipping option at all) is
   * a checkout that cannot complete.
   */
  fallbackCents: number
}

export const SHIPPING_REGIONS: ShippingRegion[] = [
  {
    id: 'us-standard',
    label: 'Standard — United States',
    countries: ['US'],
    reference: { city: 'Springfield', stateCode: 'IL', postcode: '62701', countryCode: 'US' },
    level: 'MAIL',
    businessDays: { min: 7, max: 21 },
    fallbackCents: 901
  },
  {
    id: 'us-expedited',
    label: 'Expedited — United States',
    countries: ['US'],
    reference: { city: 'Springfield', stateCode: 'IL', postcode: '62701', countryCode: 'US' },
    level: 'EXPEDITED',
    businessDays: { min: 3, max: 8 },
    fallbackCents: 2246
  },
  {
    id: 'canada',
    label: 'Standard — Canada',
    countries: ['CA'],
    reference: { city: 'Toronto', stateCode: 'ON', postcode: 'M5H 2N2', countryCode: 'CA' },
    level: 'MAIL',
    businessDays: { min: 7, max: 21 },
    fallbackCents: 1235
  },
  {
    id: 'europe',
    label: 'Standard — UK & Europe',
    countries: ['GB', 'IE', 'DE', 'FR', 'NL', 'BE', 'ES', 'IT', 'SE', 'DK', 'FI', 'NO', 'CH', 'AT', 'PL', 'PT'],
    reference: { city: 'Vienna', postcode: '1010', countryCode: 'AT' },
    level: 'MAIL',
    businessDays: { min: 7, max: 21 },
    fallbackCents: 1267
  },
  {
    id: 'oceania',
    label: 'Standard — Australia & New Zealand',
    countries: ['AU', 'NZ'],
    reference: { city: 'Sydney', stateCode: 'NSW', postcode: '2000', countryCode: 'AU' },
    level: 'MAIL',
    businessDays: { min: 7, max: 21 },
    fallbackCents: 1337
  }
]

/** Every country any region ships to — the list Stripe collects an address for. */
export const SHIPPING_COUNTRIES = [...new Set(SHIPPING_REGIONS.flatMap(r => r.countries))]

/** Lulu's shipping figure for a cart, grossed up so the press nets it whole. */
function toChargeCents(shippingDollars: number): number {
  return Math.ceil(((shippingDollars * 100) + PER_ORDER_CENTS) / STRIPE_RATE)
}

interface CostResponse {
  shipping_cost?: { total_cost_excl_tax?: string, total_cost_incl_tax?: string }
}

/**
 * What to charge for shipping a given set of line items to a given address.
 *
 * Excl. tax throughout: Lulu adds the destination's sales tax on top, which is
 * the buyer's to pay and not a cost of the parcel.
 */
export async function quoteShippingCents(
  lineItems: PrintQuoteItem[],
  address: { city: string, stateCode?: string, postcode: string, countryCode: string },
  level: ShippingLevel = 'MAIL'
): Promise<number | null> {
  try {
    const res = await calculatePrintCost({
      lineItems,
      shippingAddress: {
        name: 'Dorean Press',
        street1: '1 Main Street',
        city: address.city,
        state_code: address.stateCode,
        postcode: address.postcode,
        country_code: address.countryCode,
        phone_number: '+1 555 555 5555'
      },
      shippingLevel: level
    }) as CostResponse

    const shipping = Number(
      res.shipping_cost?.total_cost_excl_tax ?? res.shipping_cost?.total_cost_incl_tax
    )
    return Number.isFinite(shipping) ? toChargeCents(shipping) : null
  } catch {
    // A quote is not worth failing a sale over — the caller falls back.
    return null
  }
}

export interface ShippingOption {
  region: ShippingRegion
  amountCents: number
  /** False when Lulu could not be reached and `fallbackCents` was used instead. */
  quoted: boolean
}

/**
 * One priced option per region for this cart, quoted concurrently so checkout
 * waits for the slowest single call rather than the sum of five.
 */
export async function quoteRegionOptions(lineItems: PrintQuoteItem[]): Promise<ShippingOption[]> {
  return Promise.all(
    SHIPPING_REGIONS.map(async (region) => {
      const cents = await quoteShippingCents(lineItems, region.reference, region.level)
      return {
        region,
        amountCents: cents ?? region.fallbackCents,
        quoted: cents !== null
      }
    })
  )
}
