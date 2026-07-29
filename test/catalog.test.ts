import { describe, expect, it } from 'vitest'
import {
  catalog,
  coversWholeRequest,
  itemsCopies,
  itemsSubtotalCents,
  itemTitles,
  limitItems,
  MAX_REQUEST_COPIES,
  SPONSOR_SHIPPING_CENTS,
  sponsorTotalCents,
  subtractItems,
  summarizeTitles
} from '../shared/catalog'

// Two real slugs, so the tests exercise the same catalog lookups production
// does. Prices are never asserted directly — they change, and a test that
// hard-codes them is a test that breaks for the wrong reason.
const A = catalog[0]!.slug
const B = catalog[1]!.slug
const UNKNOWN = 'no-such-book'

describe('itemsCopies', () => {
  it('adds up copies across titles', () => {
    expect(itemsCopies([{ slug: A, quantity: 2 }, { slug: B, quantity: 3 }])).toBe(5)
  })

  it('is zero for an empty order', () => {
    expect(itemsCopies([])).toBe(0)
  })
})

describe('itemsSubtotalCents', () => {
  it('scales with quantity', () => {
    const one = itemsSubtotalCents([{ slug: A, quantity: 1 }])
    expect(itemsSubtotalCents([{ slug: A, quantity: 3 }])).toBe(one * 3)
  })

  it('skips slugs that are no longer in the catalog rather than throwing', () => {
    const real = itemsSubtotalCents([{ slug: A, quantity: 1 }])
    expect(itemsSubtotalCents([{ slug: A, quantity: 1 }, { slug: UNKNOWN, quantity: 9 }])).toBe(real)
  })
})

describe('sponsorTotalCents', () => {
  it('charges shipping once however many books are in the order', () => {
    const items = [{ slug: A, quantity: 2 }, { slug: B, quantity: 4 }]
    expect(sponsorTotalCents(items)).toBe(itemsSubtotalCents(items) + SPONSOR_SHIPPING_CENTS)
  })
})

// The gate every untrusted selection passes through before anything is charged
// or printed: a sponsor's POST, or a webhook replayed after someone else gave.
describe('limitItems', () => {
  const available = [{ slug: A, quantity: 2 }, { slug: B, quantity: 1 }]

  it('never returns more copies than the request still holds', () => {
    expect(limitItems(available, [{ slug: A, quantity: 99 }]))
      .toEqual([{ slug: A, quantity: 2 }])
  })

  it('drops slugs that were never part of the request', () => {
    expect(limitItems(available, [{ slug: UNKNOWN, quantity: 1 }, { slug: B, quantity: 1 }]))
      .toEqual([{ slug: B, quantity: 1 }])
  })

  it('merges duplicate lines for the same slug before clamping', () => {
    expect(limitItems(available, [{ slug: A, quantity: 1 }, { slug: A, quantity: 1 }]))
      .toEqual([{ slug: A, quantity: 2 }])
  })

  it('ignores quantities that are zero, negative or not a number', () => {
    expect(limitItems(available, [
      { slug: A, quantity: 0 },
      { slug: B, quantity: -3 }
    ])).toEqual([])
    expect(limitItems(available, [{ slug: A, quantity: Number.NaN }])).toEqual([])
  })

  it('returns lines in the order the reader requested them, not the order picked', () => {
    expect(limitItems(available, [{ slug: B, quantity: 1 }, { slug: A, quantity: 1 }])
      .map(i => i.slug)).toEqual([A, B])
  })

  it('treats an empty selection as nothing chosen', () => {
    expect(limitItems(available, [])).toEqual([])
  })
})

describe('subtractItems', () => {
  const items = [{ slug: A, quantity: 3 }, { slug: B, quantity: 1 }]

  it('leaves the unfunded remainder', () => {
    expect(subtractItems(items, [{ slug: A, quantity: 1 }]))
      .toEqual([{ slug: A, quantity: 2 }, { slug: B, quantity: 1 }])
  })

  it('drops a line once every copy of it is funded', () => {
    expect(subtractItems(items, [{ slug: B, quantity: 1 }]))
      .toEqual([{ slug: A, quantity: 3 }])
  })

  it('returns nothing when the whole order is funded', () => {
    expect(subtractItems(items, items)).toEqual([])
  })

  it('does not go negative if more copies are funded than were asked for', () => {
    expect(subtractItems(items, [{ slug: A, quantity: 10 }]))
      .toEqual([{ slug: B, quantity: 1 }])
  })
})

describe('coversWholeRequest', () => {
  const items = [{ slug: A, quantity: 2 }, { slug: B, quantity: 1 }]

  it('is true only when every copy of every title is picked', () => {
    expect(coversWholeRequest(items, items)).toBe(true)
    expect(coversWholeRequest(items, [{ slug: A, quantity: 2 }])).toBe(false)
    expect(coversWholeRequest(items, [{ slug: A, quantity: 1 }, { slug: B, quantity: 1 }])).toBe(false)
  })
})

describe('itemTitles', () => {
  it('resolves titles and silently skips books that have gone away', () => {
    expect(itemTitles([{ slug: A, quantity: 1 }, { slug: UNKNOWN, quantity: 1 }]))
      .toEqual([catalog[0]!.title])
  })
})

describe('summarizeTitles', () => {
  it('reads as prose at each length', () => {
    expect(summarizeTitles([])).toBe('your order')
    expect(summarizeTitles(['A'])).toBe('A')
    expect(summarizeTitles(['A', 'B'])).toBe('A and B')
    expect(summarizeTitles(['A', 'B', 'C'])).toBe('A, B, and C')
  })
})

describe('MAX_REQUEST_COPIES', () => {
  it('leaves room for a couple of copies without being a wholesale channel', () => {
    expect(MAX_REQUEST_COPIES).toBeGreaterThan(1)
    expect(MAX_REQUEST_COPIES).toBeLessThan(20)
  })
})
