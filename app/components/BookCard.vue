<script setup lang="ts">
import { type Book, formatPrice } from '#shared/catalog'

defineProps<{ book: Book }>()

const { add } = useCart()
const toast = useToast()

function addToCart(book: Book) {
  add(book.slug)
  toast.add({
    title: 'Added to cart',
    description: book.title,
    icon: 'i-lucide-check',
    color: 'primary'
  })
}
</script>

<template>
  <div class="group flex flex-col overflow-hidden rounded-lg ring ring-default bg-default transition hover:ring-primary/40 hover:shadow-lg">
    <NuxtLink
      :to="`/catalog/${book.slug}`"
      class="relative block overflow-hidden bg-elevated"
    >
      <img
        :src="book.cover"
        :alt="`Cover of ${book.title}`"
        class="aspect-[2/3] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      >
      <UBadge
        v-if="book.freePdfUrl"
        label="Free PDF"
        color="primary"
        variant="solid"
        size="sm"
        class="absolute left-3 top-3"
      />
    </NuxtLink>

    <div class="flex flex-1 flex-col gap-3 p-4">
      <div class="flex-1 space-y-1">
        <NuxtLink :to="`/catalog/${book.slug}`">
          <h3 class="font-display text-lg leading-tight font-semibold text-highlighted group-hover:text-primary">
            {{ book.title }}
          </h3>
        </NuxtLink>
        <p class="text-sm text-muted">
          {{ book.author }}
        </p>
        <p class="line-clamp-2 pt-1 text-sm text-toned">
          {{ book.tagline }}
        </p>
      </div>

      <div class="flex items-center justify-between gap-2">
        <span class="font-display text-lg font-semibold text-highlighted">
          {{ formatPrice(book.priceCents, book.currency) }}
        </span>
        <UButton
          label="Add to cart"
          icon="i-lucide-plus"
          size="sm"
          color="primary"
          variant="soft"
          @click="addToCart(book)"
        />
      </div>
    </div>
  </div>
</template>
