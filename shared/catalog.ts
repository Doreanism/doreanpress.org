// Single source of truth for the Dorean Press catalog.
//
// This module is imported by both the app (catalog pages) and the Nitro server
// (Stripe checkout + Lulu fulfilment) via the `#shared` alias, so prices and
// print specifications can never drift between what a customer sees and what we
// actually charge / print.

export interface LuluSpec {
  /**
   * Lulu POD package id describing trim size, paper, binding and finish.
   * e.g. '0600X0900BWSTDPB060UW444GXX' (6"x9" b/w paperback). Find valid ids in
   * the Lulu pricing calculator / API docs.
   */
  podPackageId: string
  /** Interior page count — required for cost calculation. */
  pageCount: number
  /** Publicly reachable, print-ready interior PDF (Lulu fetches this URL). */
  interiorPdfUrl: string
  /** Publicly reachable, print-ready cover PDF. */
  coverPdfUrl: string
}

export interface Book {
  slug: string
  title: string
  subtitle?: string
  author: string
  year?: number
  isbn?: string
  /** Human-readable format line, e.g. 'Paperback · 6×9 · 184 pages'. */
  format: string
  /** Trim size incl. spine thickness, e.g. '5.5 x 8.5 x .45 inches'. */
  dimensions: string
  /** Shipping weight of a single copy, in ounces. */
  weightOz: number
  /**
   * Retail price the customer pays, per copy, in the smallest currency unit.
   *
   * Set at cost, in the sense that a sale nets the press roughly nothing —
   * not in the sense of Lulu's print cost alone, which would lose money on
   * every order. See `npm run lulu:prices` and the note below the catalog.
   */
  priceCents: number
  currency: 'usd'
  /** Cover image served from /public. */
  cover: string
  /** Short one-line hook shown on cards. */
  tagline: string
  /** Long description, one entry per paragraph. */
  description: string[]
  /** Optional browser-readable edition. */
  webUrl?: string
  /** Optional downloadable PDF edition. */
  pdfUrl?: string
  /** Optional downloadable EPUB edition. */
  epubUrl?: string
  /** Optional retailer listing for print and Kindle editions. */
  amazonUrl?: string
  featured?: boolean
  lulu: LuluSpec
}

// How `priceCents` below were arrived at, quoted from api.lulu.com on
// 2026-08-08 (`npm run lulu:prices`):
//
//   print/copy = $1.99 + $0.025/page, flat 32–800pp, same for every trim size
//
// A price covers printing one copy and nothing else. Everything charged once per
// order rather than per copy — Lulu's $0.75 fulfilment fee, Stripe's fixed 30¢,
// and the postage itself — rides on the shipping line instead, which is quoted
// live per cart and per destination in `server/utils/shipping.ts`. Keeping the
// two apart is what stops a second copy from paying a second postage.
//
// What remains is Stripe's 2.9%, which is taken from the whole charge including
// the books, so each price is grossed up to survive it:
//
//   priceCents = ceil(print / 0.971)
//
// Net result: a sale returns the press ~$0.00. That is at cost in the sense the
// dorean principle intends — the reader pays what the book costs to reach them,
// and the press takes none of it. Re-run the script when a page count changes or
// Lulu moves its rates.
export const catalog: Book[] = [
  {
    slug: 'the-doctrine-of-simony',
    title: 'The Doctrine of Simony',
    subtitle: 'A Theological Retrieval and Appraisal',
    author: 'Conley Owens',
    year: 2026,
    isbn: '979-8-1749-3028-5',
    format: 'Paperback · 5.5×8.5 · 332 pages',
    dimensions: '5.5 x 8.5 x .83 inches',
    weightOz: 17.6,
    priceCents: 1060, // print $10.29 (332pp)
    currency: 'usd',
    cover: '/covers/the-doctrine-of-simony.webp',
    tagline: 'Recovering an old doctrine for the practices of the church today.',
    description: [
      'The prohibition of simony filled canon law from the patristic period, occupied the schoolmen, and entered the confessional standards of the Reformation. Today, most Christians have never heard the word.',
      'The Doctrine of Simony brings that scattered inheritance into a single account, expounding simony’s definition clause by clause and recovering the tradition’s answers to the standard questions that accompanied it. What does Scripture say of the sin? How severely should it be regarded? How may a minister receive support without committing it?',
      'The book then addresses the practices of our own day that run afoul of that doctrine. The Protestant Reformation itself began in a dispute over the sale of spiritual things. What new reformation awaits a church that learns again to discern the sin of simony?'
    ],
    webUrl: 'https://simony.info',
    pdfUrl: 'https://simony.info/the-doctrine-of-simony.pdf',
    epubUrl: 'https://simony.info/the-doctrine-of-simony.epub',
    amazonUrl: 'https://www.amazon.com/dp/B0HKC6P7N6',
    featured: true,
    lulu: {
      podPackageId: '0550X0850BWSTDPB060UW444GXX',
      pageCount: 332,
      interiorPdfUrl: 'https://simony.info/the-doctrine-of-simony.pdf',
      coverPdfUrl: 'https://simony.info/cover.pdf'
    }
  }
]

export function findBook(slug: string): Book | undefined {
  return catalog.find(b => b.slug === slug)
}

export function formatPrice(cents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(cents / 100)
}

/** Render a total weight (in ounces) as pounds, e.g. '6.39 pounds'. */
export function formatPounds(totalOz: number): string {
  return `${(totalOz / 16).toFixed(2)} pounds`
}

// ── Pay-it-forward requests ──────────────────────────────────────────────
//
// A request is an *order*: one or more titles a reader asked for. A sponsor may
// cover the whole thing or pick out part of it, so anything unfunded stays on
// the board for someone else. These helpers live here so the board, the Stripe
// session and the emails all price and describe a selection the same way.

/** One line of a book request: a catalog slug and how many copies. */
export interface RequestItem {
  slug: string
  quantity: number
}

/**
 * Flat shipping a sponsor covers for a whole request — one order ships in one
 * parcel, so this is charged once regardless of how many titles it holds.
 *
 * Unlike the cart, this one cannot be quoted live. The board prices every
 * request in the browser as the sponsor picks copies on and off, and a Lulu
 * call per adjustment is not something to put behind a button that moves that
 * often. So it stays flat, now set from real quotes rather than invention:
 * $5.69 postage to a typical US address, plus Lulu's 75¢ fulfilment and
 * Stripe's 30¢, grossed up for Stripe's 2.9%.
 *
 * Two ways it is still wrong, both under-recovering rather than over-charging:
 * a request going overseas costs more to post than this (Canada and New Zealand
 * roughly double it), and a large request costs more than a small one. Pricing
 * either properly means knowing the destination while the board renders —
 * either by quoting once when the request is made and storing it, or by putting
 * the country on the public request. Both are real changes; neither is this one.
 */
export const SPONSOR_SHIPPING_CENTS = 695

/** Subtotal of a request's books, in cents. Unknown slugs are skipped. */
export function itemsSubtotalCents(items: RequestItem[]): number {
  return items.reduce((n, item) => {
    const book = findBook(item.slug)
    return book ? n + book.priceCents * item.quantity : n
  }, 0)
}

/** What a sponsor pays to cover a whole request: books plus one shipping charge. */
export function sponsorTotalCents(items: RequestItem[]): number {
  return itemsSubtotalCents(items) + SPONSOR_SHIPPING_CENTS
}

/** Total copies across a set of request lines. */
export function itemsCopies(items: RequestItem[]): number {
  return items.reduce((n, item) => n + item.quantity, 0)
}

/**
 * Narrow a chosen selection down to what a request actually still holds: only
 * requested slugs, never more copies than remain, no duplicate lines. Untrusted
 * input (a sponsor's POST, a webhook replayed after someone else gave) passes
 * through here before anything is charged or printed.
 */
export function limitItems(available: RequestItem[], chosen: RequestItem[]): RequestItem[] {
  const wanted = new Map<string, number>()
  for (const item of chosen) {
    const quantity = Math.floor(Number(item?.quantity))
    if (!Number.isFinite(quantity) || quantity < 1) continue
    wanted.set(item.slug, (wanted.get(item.slug) ?? 0) + quantity)
  }

  return available
    .map((item) => {
      const quantity = Math.min(item.quantity, wanted.get(item.slug) ?? 0)
      return quantity > 0 ? { slug: item.slug, quantity } : null
    })
    .filter((i): i is RequestItem => i !== null)
}

/**
 * Several orders' lines as one list, adding up the copies of a repeated title.
 *
 * For describing a reader's orders together — the board fans one hand of covers
 * over everything they are waiting for — never for charging or printing, which
 * stay per order.
 */
export function mergeItems(lists: RequestItem[][]): RequestItem[] {
  const merged: RequestItem[] = []
  for (const item of lists.flat()) {
    const existing = merged.find(i => i.slug === item.slug)
    if (existing) existing.quantity += item.quantity
    else merged.push({ ...item })
  }
  return merged
}

/** What is left of a request once some copies have been sponsored. */
export function subtractItems(items: RequestItem[], funded: RequestItem[]): RequestItem[] {
  const taken = new Map<string, number>()
  for (const item of funded) {
    taken.set(item.slug, (taken.get(item.slug) ?? 0) + item.quantity)
  }

  return items
    .map((item) => {
      const quantity = item.quantity - Math.min(item.quantity, taken.get(item.slug) ?? 0)
      return quantity > 0 ? { slug: item.slug, quantity } : null
    })
    .filter((i): i is RequestItem => i !== null)
}

/** True when a selection covers every copy of every title in the request. */
export function coversWholeRequest(items: RequestItem[], selected: RequestItem[]): boolean {
  return subtractItems(items, selected).length === 0
}

/** Titles of a request's books, in the order they were requested. */
export function itemTitles(items: RequestItem[]): string[] {
  return items
    .map(item => findBook(item.slug)?.title)
    .filter((t): t is string => Boolean(t))
}

/** Join titles into prose: 'A', 'A and B', 'A, B, and C'. */
export function summarizeTitles(titles: string[]): string {
  if (titles.length === 0) return 'your order'
  if (titles.length === 1) return titles[0]!
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`
  return `${titles.slice(0, -1).join(', ')}, and ${titles[titles.length - 1]}`
}
