<script setup lang="ts">
import { findBook, formatPrice } from '#shared/catalog'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const book = computed(() => findBook(slug.value))

if (!book.value) {
  throw createError({ statusCode: 404, statusMessage: 'Book not found', fatal: true })
}

const { add } = useCart()
const toast = useToast()
const quantity = ref(1)

function addToCart() {
  if (!book.value) return
  add(book.value.slug, quantity.value)
  toast.add({
    title: 'Added to cart',
    description: `${quantity.value} × ${book.value.title}`,
    icon: 'i-lucide-check',
    color: 'primary'
  })
}

useSeoMeta({
  title: () => book.value?.title,
  description: () => book.value?.tagline,
  ogImage: () => book.value?.cover
})

const details = computed(() => {
  if (!book.value) return []
  const b = book.value
  return [
    { label: 'Author', value: b.author },
    { label: 'Format', value: b.format },
    { label: 'Pages', value: String(b.lulu.pageCount) },
    { label: 'Dimensions', value: b.dimensions },
    { label: 'Weight', value: `${b.weightOz} ounces` },
    b.year ? { label: 'Published', value: String(b.year) } : null,
    b.isbn ? { label: 'ISBN', value: b.isbn } : null
  ].filter(Boolean) as { label: string, value: string }[]
})
</script>

<template>
  <UContainer
    v-if="book"
    class="py-12 sm:py-16"
  >
    <UButton
      to="/catalog"
      label="Back to catalog"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="link"
      class="mb-8 -ml-2"
    />

    <div class="grid gap-10 lg:grid-cols-[2fr_3fr] lg:gap-14">
      <!-- Cover + buy box -->
      <div class="space-y-6">
        <img
          :src="book.cover"
          :alt="`Cover of ${book.title}`"
          class="mx-auto w-full max-w-xs rounded-lg shadow-xl ring ring-default"
        >

        <div class="rounded-lg ring ring-default bg-default p-5">
          <div class="flex items-baseline justify-between">
            <span class="font-display text-3xl font-semibold text-highlighted">
              {{ formatPrice(book.priceCents, book.currency) }}
            </span>
            <span class="text-sm text-muted">printed &amp; shipped at cost</span>
          </div>

          <div class="mt-5 flex items-center gap-3">
            <UInputNumber
              v-model="quantity"
              :min="1"
              :max="99"
              class="w-28"
            />
            <UButton
              label="Add to cart"
              icon="i-lucide-shopping-cart"
              color="primary"
              size="lg"
              block
              class="flex-1"
              @click="addToCart"
            />
          </div>

          <UButton
            v-if="book.freePdfUrl"
            :to="book.freePdfUrl"
            target="_blank"
            label="Read the free digital edition"
            icon="i-lucide-book-open"
            color="neutral"
            variant="subtle"
            block
            class="mt-3"
          />

          <p class="mt-4 text-xs text-muted">
            Orders are printed on demand through Lulu and shipped directly to you. Please allow time for printing and delivery.
          </p>
        </div>
      </div>

      <!-- Details -->
      <div>
        <h1 class="font-display text-4xl font-semibold text-highlighted">
          {{ book.title }}
        </h1>
        <p
          v-if="book.subtitle"
          class="mt-2 font-display text-xl text-muted italic"
        >
          {{ book.subtitle }}
        </p>
        <p class="mt-3 text-lg text-toned">
          by {{ book.author }}
        </p>

        <div class="mt-8 space-y-4 text-base/7 text-toned">
          <p
            v-for="(para, i) in book.description"
            :key="i"
          >
            {{ para }}
          </p>
        </div>

        <USeparator class="my-8" />

        <dl class="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          <div
            v-for="d in details"
            :key="d.label"
            class="flex justify-between gap-4 border-b border-default pb-2 sm:block sm:border-0 sm:pb-0"
          >
            <dt class="text-sm font-medium text-muted">
              {{ d.label }}
            </dt>
            <dd class="text-sm text-highlighted sm:mt-0.5">
              {{ d.value }}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </UContainer>
</template>
