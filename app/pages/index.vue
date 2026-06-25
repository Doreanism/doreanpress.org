<script setup lang="ts">
import { catalog } from '#shared/catalog'

const featured = computed(() => catalog.filter(b => b.featured).concat(catalog.filter(b => !b.featured)).slice(0, 4))

useSeoMeta({
  title: 'Books on a freely given gospel',
  description: 'Dorean Press publishes books on the church and the commercialization of Christianity — printed on demand and sold at honest cost.'
})
</script>

<template>
  <div>
    <UPageHero
      :ui="{ title: 'font-display' }"
      title="The gospel is not for sale."
      description="Dorean Press is a publishing ministry recovering an old conviction — “freely you have received; freely give.” We print thoughtful books on the church and the commercialization of Christianity, and we sell them at honest cost."
      :links="[{
        label: 'Browse the catalog',
        to: '/catalog',
        trailingIcon: 'i-lucide-arrow-right',
        size: 'xl'
      }, {
        label: 'Our conviction',
        to: '/about',
        icon: 'i-lucide-heart-handshake',
        size: 'xl',
        color: 'neutral',
        variant: 'subtle'
      }]"
    />

    <UPageSection
      title="From the catalog"
      description="Each title is printed on demand through Lulu and priced just above the cost of printing — never to turn proclamation into profit."
      :ui="{ title: 'font-display' }"
    >
      <div class="grid grid-cols-2 gap-6 lg:grid-cols-4">
        <BookCard
          v-for="book in featured"
          :key="book.slug"
          :book="book"
        />
      </div>

      <div class="mt-10 flex justify-center">
        <UButton
          label="See all books"
          to="/catalog"
          color="neutral"
          variant="subtle"
          trailing-icon="i-lucide-arrow-right"
          size="lg"
        />
      </div>
    </UPageSection>

    <UPageSection
      :ui="{ container: 'border-t border-default', title: 'font-display' }"
      title="Why we publish at cost"
      description="Three commitments shape everything that leaves our press."
      :features="[{
        icon: 'i-lucide-gift',
        title: 'Freely given',
        description: 'We never put a paywall between a reader and the message of the gospel. Where we can, the digital edition is free to download.'
      }, {
        icon: 'i-lucide-printer',
        title: 'Printed on demand',
        description: 'Books are printed and shipped only when ordered, through Lulu’s global print network. No warehouses, no waste, no overstock.'
      }, {
        icon: 'i-lucide-receipt',
        title: 'Honest pricing',
        description: 'You pay the cost of printing and shipping, plus a small margin that keeps the press running — and nothing more.'
      }]"
    />

    <UPageSection>
      <UPageCTA
        :ui="{ title: 'font-display' }"
        title="Read freely. Give freely."
        description="Start with The Dorean Principle — the book this press is named for — or browse the whole catalog."
        variant="subtle"
        :links="[{
          label: 'Start reading',
          to: '/catalog/the-dorean-principle',
          trailingIcon: 'i-lucide-arrow-right'
        }, {
          label: 'About Dorean Press',
          to: '/about',
          color: 'neutral',
          variant: 'outline'
        }]"
      />
    </UPageSection>
  </div>
</template>
