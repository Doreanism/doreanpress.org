// Single source of truth for the Dorean Press catalog.
//
// This module is imported by both the app (catalog pages) and the Nitro server
// (requests, fulfilment and emails) via the `#shared` alias, so every part of
// the site describes a book the same way.

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
  /** Interior page count. */
  pageCount: number
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
  /** Direct KDP author-copy ordering page, when known. */
  authorCopiesUrl?: string
  featured?: boolean
}

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
    pageCount: 332,
    cover: '/covers/the-doctrine-of-simony.webp',
    tagline: 'Recovering the doctrine of simony for the practices of the church today.',
    description: [
      'The prohibition of simony filled canon law from the patristic period, occupied the schoolmen, and entered the confessional standards of the Reformation. Today, most Christians have never heard the word.',
      'The Doctrine of Simony brings that scattered inheritance into a single account, expounding simony’s definition clause by clause and recovering the tradition’s answers to the standard questions that accompanied it. What does Scripture say of the sin? How severely should it be regarded? How may a minister receive support without committing it?',
      'The book then addresses the practices of our own day that run afoul of that doctrine. The Protestant Reformation itself began in a dispute over the sale of spiritual things. What new reformation awaits a church that learns again to discern the sin of simony?'
    ],
    webUrl: 'https://simony.info',
    pdfUrl: 'https://simony.info/the-doctrine-of-simony.pdf',
    epubUrl: 'https://simony.info/the-doctrine-of-simony.epub',
    amazonUrl: 'https://www.amazon.com/dp/B0HKC6P7N6',
    authorCopiesUrl: 'https://kdp.amazon.com/en_US/title-setup/paperback/4N2JZPVXPDT/author-orders?ref_=kdp_BS_D_ta_ao_main',
    featured: true
  }
]

export function findBook(slug: string): Book | undefined {
  return catalog.find(b => b.slug === slug)
}

/** Render a total weight (in ounces) as pounds, e.g. '6.39 pounds'. */
export function formatPounds(totalOz: number): string {
  return `${(totalOz / 16).toFixed(2)} pounds`
}

// ── Pay-it-forward requests ──────────────────────────────────────────────
//
// A request is an *order*: one or more titles a reader asked for. A sponsor may
// cover the whole thing or pick out part of it, so anything unfunded stays on
// the board for someone else. These helpers live here so the board, the gift
// flow and the emails all describe a selection the same way.

/** One line of a book request: a catalog slug and how many copies. */
export interface RequestItem {
  slug: string
  quantity: number
}

/** Total copies across a set of request lines. */
export function itemsCopies(items: RequestItem[]): number {
  return items.reduce((n, item) => n + item.quantity, 0)
}

/**
 * Narrow a chosen selection down to what a request actually still holds: only
 * requested slugs, never more copies than remain, no duplicate lines. Untrusted
 * input (a sponsor's POST, a webhook replayed after someone else gave) passes
 * through here before anything is reserved or ordered.
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
 * over everything they are waiting for — never for reserving or ordering, which
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
