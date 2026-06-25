import { catalog, findBook, type Book } from '#shared/catalog'

export interface CartItem {
  slug: string
  quantity: number
}

export interface CartLine extends CartItem {
  book: Book
  lineTotalCents: number
}

const STORAGE_KEY = 'dorean-cart'

export function useCart() {
  const items = useState<CartItem[]>('cart', () => [])

  // Hydrate from localStorage on the client and keep it in sync.
  if (import.meta.client) {
    onMounted(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) items.value = JSON.parse(raw)
      } catch {
        // ignore malformed storage
      }
    })

    watch(items, (val) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    }, { deep: true })
  }

  const lines = computed<CartLine[]>(() =>
    items.value
      .map((item) => {
        const book = findBook(item.slug)
        if (!book) return null
        return {
          ...item,
          book,
          lineTotalCents: book.priceCents * item.quantity
        }
      })
      .filter((l): l is CartLine => l !== null))

  const count = computed(() => items.value.reduce((n, i) => n + i.quantity, 0))
  const subtotalCents = computed(() => lines.value.reduce((n, l) => n + l.lineTotalCents, 0))
  const isEmpty = computed(() => count.value === 0)

  function add(slug: string, quantity = 1) {
    if (!findBook(slug)) return
    const existing = items.value.find(i => i.slug === slug)
    if (existing) {
      existing.quantity = Math.min(99, existing.quantity + quantity)
    } else {
      items.value = [...items.value, { slug, quantity }]
    }
  }

  function setQuantity(slug: string, quantity: number) {
    const q = Math.max(0, Math.min(99, Math.floor(quantity)))
    if (q === 0) return remove(slug)
    const existing = items.value.find(i => i.slug === slug)
    if (existing) existing.quantity = q
  }

  function remove(slug: string) {
    items.value = items.value.filter(i => i.slug !== slug)
  }

  function clear() {
    items.value = []
  }

  return {
    items,
    lines,
    count,
    subtotalCents,
    isEmpty,
    add,
    setQuantity,
    remove,
    clear,
    catalog
  }
}
