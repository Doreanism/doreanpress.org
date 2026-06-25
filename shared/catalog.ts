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
  /** Retail price the customer pays, per copy, in the smallest currency unit. */
  priceCents: number
  currency: 'usd'
  /** Cover image served from /public. */
  cover: string
  /** Short one-line hook shown on cards. */
  tagline: string
  /** Long description, one entry per paragraph. */
  description: string[]
  /** Optional free digital edition — the dorean principle in practice. */
  freePdfUrl?: string
  featured?: boolean
  lulu: LuluSpec
}

export const catalog: Book[] = [
  {
    slug: 'the-dorean-principle',
    title: 'The Dorean Principle',
    subtitle: 'A Biblical Response to the Commercialization of Christianity',
    author: 'Conley Owens',
    year: 2021,
    isbn: '978-1-styled-sample',
    format: 'Paperback · 6×9 · 220 pages',
    dimensions: '6 x 9 x .50 inches',
    weightOz: 12.8,
    priceCents: 1200,
    currency: 'usd',
    cover: '/covers/the-dorean-principle.svg',
    tagline: 'Reclaiming the conviction that the gospel is freely given.',
    description: [
      'In Matthew 10:8, Jesus charges his disciples, “Freely you have received; freely give.” The Dorean Principle examines what it means to honour that charge in an age that has learned to treat ministry as a marketplace.',
      'Drawing on the whole counsel of Scripture, Conley Owens distinguishes between the reciprocity that funds gospel work and the commerce that sells it — and argues that the difference is not incidental but essential to the integrity of the message.',
      'This is the flagship title of Dorean Press: a book that both explains why we publish at cost and invites the church to recover a freely-given ministry.'
    ],
    freePdfUrl: 'https://thedoreanprinciple.org/book',
    featured: true,
    lulu: {
      podPackageId: '0600X0900BWSTDPB060UW444GXX',
      pageCount: 220,
      interiorPdfUrl: 'https://files.doreanpress.org/the-dorean-principle/interior.pdf',
      coverPdfUrl: 'https://files.doreanpress.org/the-dorean-principle/cover.pdf'
    }
  },
  {
    slug: 'freely-you-have-received',
    title: 'Freely You Have Received',
    subtitle: 'Essays on Funding the Work of the Gospel',
    author: 'Dorean Press (ed.)',
    year: 2023,
    format: 'Paperback · 6×9 · 168 pages',
    dimensions: '6 x 9 x .38 inches',
    weightOz: 9.8,
    priceCents: 1000,
    currency: 'usd',
    cover: '/covers/freely-you-have-received.svg',
    tagline: 'A collection on supporting ministry without selling it.',
    description: [
      'A gathered volume of essays exploring how churches, missionaries, and writers can be generously supported while keeping the gospel itself free of charge.',
      'Contributors take up the practical questions: patronage, salaries, donations, royalties, and the quiet pressures that turn proclamation into product.',
      '(Sample catalog entry — replace with your real edition details and print files.)'
    ],
    lulu: {
      podPackageId: '0600X0900BWSTDPB060UW444GXX',
      pageCount: 168,
      interiorPdfUrl: 'https://files.doreanpress.org/freely-you-have-received/interior.pdf',
      coverPdfUrl: 'https://files.doreanpress.org/freely-you-have-received/cover.pdf'
    }
  },
  {
    slug: 'merchants-in-the-temple',
    title: 'Merchants in the Temple?',
    subtitle: 'The Commercialization of the Church, Past and Present',
    author: 'A. Sample Author',
    year: 2024,
    format: 'Paperback · 5.5×8.5 · 256 pages',
    dimensions: '5.5 x 8.5 x .58 inches',
    weightOz: 12.6,
    priceCents: 1400,
    currency: 'usd',
    cover: '/covers/merchants-in-the-temple.svg',
    tagline: 'A historical survey of paywalls in the pulpit.',
    description: [
      'From indulgences to influencers, this survey traces how the people of God have repeatedly drifted toward selling what was meant to be given.',
      'Each chapter pairs a historical episode with a contemporary parallel, asking what faithfulness looks like for the modern church and Christian publisher.',
      '(Sample catalog entry — replace with your real edition details and print files.)'
    ],
    lulu: {
      podPackageId: '0550X0850BWSTDPB060UW444GXX',
      pageCount: 256,
      interiorPdfUrl: 'https://files.doreanpress.org/merchants-in-the-temple/interior.pdf',
      coverPdfUrl: 'https://files.doreanpress.org/merchants-in-the-temple/cover.pdf'
    }
  },
  {
    slug: 'colaborers',
    title: 'Colaborers',
    subtitle: 'A Short Theology of Gospel Patronage',
    author: 'A. Sample Author',
    year: 2025,
    format: 'Paperback · 5×8 · 120 pages',
    dimensions: '5 x 8 x .27 inches',
    weightOz: 5.4,
    priceCents: 900,
    currency: 'usd',
    cover: '/covers/colaborers.svg',
    tagline: 'How the church becomes a fellow worker with the truth.',
    description: [
      'Drawing on 3 John’s commendation of those who support travelling teachers “in a manner worthy of God,” Colaborers offers a compact theology of how believers fund the gospel as partners rather than customers.',
      '(Sample catalog entry — replace with your real edition details and print files.)'
    ],
    lulu: {
      podPackageId: '0500X0800BWSTDPB060UW444GXX',
      pageCount: 120,
      interiorPdfUrl: 'https://files.doreanpress.org/colaborers/interior.pdf',
      coverPdfUrl: 'https://files.doreanpress.org/colaborers/cover.pdf'
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
