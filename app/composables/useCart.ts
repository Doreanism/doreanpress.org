import { catalog, findBook, type Book } from '#shared/catalog'

export interface CartItem {
  slug: string
  quantity: number
}

export interface CartLine extends CartItem {
  book: Book
  lineTotalCents: number
  /** Combined shipping weight of this line, in ounces. */
  lineWeightOz: number
}

const STORAGE_KEY = 'dorean-cart'

/**
 * Client only. The stored cart is adopted once — after mount, so the
 * server-rendered markup matches — and every caller shares that one read.
 * An explicit change always wins: if something empties the cart before the
 * read happens (as `/checkout/success` does), storage is not read back over it.
 */
let adopted = false

export function useCart() {
  const items = useState<CartItem[]>('cart', () => [])

  function persist() {
    if (!import.meta.client) return
    adopted = true
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
    } catch {
      // storage may be full or blocked; the in-memory cart still works
    }
  }

  if (import.meta.client) {
    onMounted(() => {
      if (adopted) return
      adopted = true
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) items.value = JSON.parse(raw)
      } catch {
        // ignore malformed storage
      }
    })
  }

  const lines = computed<CartLine[]>(() =>
    items.value
      .map((item) => {
        const book = findBook(item.slug)
        if (!book) return null
        return {
          ...item,
          book,
          lineTotalCents: book.priceCents * item.quantity,
          lineWeightOz: book.weightOz * item.quantity
        }
      })
      .filter((l): l is CartLine => l !== null))

  const count = computed(() => items.value.reduce((n, i) => n + i.quantity, 0))
  const subtotalCents = computed(() => lines.value.reduce((n, l) => n + l.lineTotalCents, 0))
  const totalWeightOz = computed(() => lines.value.reduce((n, l) => n + l.lineWeightOz, 0))
  const isEmpty = computed(() => count.value === 0)

  function add(slug: string, quantity = 1) {
    if (!findBook(slug)) return
    const existing = items.value.find(i => i.slug === slug)
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + quantity)
    } else {
      items.value = [...items.value, { slug, quantity }]
    }
    persist()
  }

  function setQuantity(slug: string, quantity: number) {
    const q = Math.max(0, Math.min(99, Math.floor(quantity)))
    if (q === 0) return remove(slug)
    const existing = items.value.find(i => i.slug === slug)
    if (existing) existing.quantity = q
    persist()
  }

  function remove(slug: string) {
    items.value = items.value.filter(i => i.slug !== slug)
    persist()
  }

  function clear() {
    items.value = []
    persist()
  }

  return {
    items,
    lines,
    count,
    subtotalCents,
    totalWeightOz,
    isEmpty,
    add,
    setQuantity,
    remove,
    clear,
    catalog
  }
}
