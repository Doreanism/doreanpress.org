<script setup lang="ts">
import { findBook } from '#shared/catalog'

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const book = computed(() => findBook(slug.value))

if (!book.value) {
  throw createError({ statusCode: 404, statusMessage: 'Book not found', fatal: true })
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
    { label: 'Pages', value: String(b.pageCount) },
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
    <div class="grid gap-10 lg:grid-cols-[2fr_3fr] lg:gap-14">
      <!-- Cover + buy box -->
      <div class="space-y-6">
        <img
          :src="book.cover"
          :alt="`Cover of ${book.title}`"
          class="mx-auto w-full max-w-xs rounded-lg shadow-xl ring ring-default"
        >

        <div class="rounded-lg ring ring-default bg-default p-5">
          <UButton
            v-if="book.webUrl"
            :to="book.webUrl"
            target="_blank"
            label="Read online"
            icon="i-lucide-book-open"
            size="lg"
            block
          />

          <div
            v-if="book.pdfUrl || book.epubUrl"
            class="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <UButton
              v-if="book.pdfUrl"
              :to="book.pdfUrl"
              target="_blank"
              label="Download PDF"
              icon="i-lucide-download"
              color="neutral"
              variant="subtle"
              block
            />
            <UButton
              v-if="book.epubUrl"
              :to="book.epubUrl"
              target="_blank"
              label="Download EPUB"
              icon="i-lucide-tablet-smartphone"
              color="neutral"
              variant="subtle"
              block
            />
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <UButton
              v-if="book.amazonUrl"
              :to="book.amazonUrl"
              target="_blank"
              label="Buy on Amazon"
              icon="i-simple-icons-amazon"
              color="neutral"
              variant="subtle"
              size="lg"
              block
            />
            <RequestFreeModal
              :items="[{ slug: book.slug, quantity: 1 }]"
              :class="{ 'sm:col-span-2': !book.amazonUrl }"
            />
          </div>
        </div>

        <OutstandingRequests
          :slug="book.slug"
          compact
        />
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
