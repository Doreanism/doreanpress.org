<script setup lang="ts">
import type { Book } from '#shared/catalog'

defineProps<{ book: Book }>()
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
    </div>
  </div>
</template>
