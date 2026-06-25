<script setup lang="ts">
import { catalog } from '#shared/catalog'

useSeoMeta({
  title: 'Catalog',
  description: 'Browse every title from Dorean Press — books on the church and the commercialization of Christianity, printed on demand and sold at cost.'
})
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="The Catalog"
      description="Every title is printed on demand and priced just above the cost of printing. Browse, and order a copy for yourself or to give away."
    />

    <div class="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
      <BookCard
        v-for="book in catalog"
        :key="book.slug"
        :book="book"
      />
    </div>
  </UContainer>
</template>
