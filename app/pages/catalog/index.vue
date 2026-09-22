<script setup lang="ts">
import { catalog } from '#shared/catalog'

useSeoMeta({
  title: 'Catalog',
  description: 'The Doctrine of Simony by Conley Owens, available on Amazon and in free digital editions.'
})
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="The Catalog"
      description="Our first title is printed on demand and priced just above the cost of printing. Order a copy for yourself or to give away."
    />

    <div class="mt-10 max-w-sm">
      <BookCard
        v-for="book in catalog"
        :key="book.slug"
        :book="book"
      />
    </div>
  </UContainer>
</template>
