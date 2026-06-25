<script setup lang="ts">
useSeoMeta({
  title: 'About',
  description: 'Dorean Press is a publishing ministry founded on the conviction that the gospel is freely given. Learn why we print on demand and sell at cost.'
})

const principles = [
  {
    icon: 'i-lucide-gift',
    title: 'Freely given',
    body: 'The word “dorean” (δωρεάν) means “freely, as a gift.” It is the word Jesus uses in Matthew 10:8 — “freely you have received; freely give.” We take it as our charter.'
  },
  {
    icon: 'i-lucide-scale',
    title: 'Sold at cost',
    body: 'We are not in the business of profiting from proclamation. Our prices cover printing, shipping, and the bare keeping of the press — no more.'
  },
  {
    icon: 'i-lucide-printer',
    title: 'Printed on demand',
    body: 'Every book is printed and shipped only when you order it, through Lulu’s global print network. Nothing sits in a warehouse; nothing goes to waste.'
  },
  {
    icon: 'i-lucide-book-open',
    title: 'Free to read',
    body: 'Wherever a title allows, the digital edition is free to download. Buy a printed copy when you want one in your hands or to give away.'
  }
]
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Freely you have received; freely give."
      description="Dorean Press exists to publish good books on the church without selling the gospel they proclaim."
    />

    <div class="mx-auto mt-10 max-w-3xl space-y-6 text-lg/8 text-toned">
      <p>
        Dorean Press is a small publishing ministry with a single conviction: the message of the gospel is a gift, and gifts are not sold. Our name comes from the Greek word <em class="font-display">dorean</em> — “freely, without payment” — the very word Christ uses when he sends out his disciples: <span class="font-display italic">“Freely you have received; freely give.”</span>
      </p>
      <p>
        That charge sits uneasily alongside a great deal of modern Christian publishing, where the teaching of the church is routinely placed behind a paywall and proclamation is repackaged as product. We believe there is a better, older way — one that distinguishes the <em>support</em> of gospel work from the <em>sale</em> of it.
      </p>
      <p>
        So we publish carefully chosen books on the church and the commercialization of Christianity, and we order them printed on demand through Lulu. You pay what it costs to print and ship a book, plus a small margin that keeps the lights on. Where we are able, the digital edition is free. Nothing about how we sell a book should contradict what the book is for.
      </p>
    </div>

    <UPageSection
      :ui="{ container: 'px-0', title: 'font-display' }"
      title="What we hold to"
      class="mt-8"
    >
      <div class="grid gap-6 sm:grid-cols-2">
        <UPageCard
          v-for="p in principles"
          :key="p.title"
          :icon="p.icon"
          :title="p.title"
          :description="p.body"
          variant="subtle"
          :ui="{ title: 'font-display' }"
        />
      </div>
    </UPageSection>

    <UPageCTA
      :ui="{ title: 'font-display' }"
      class="mt-8"
      title="Begin with the book we are named for"
      description="The Dorean Principle lays out, from Scripture, the case for a freely given ministry."
      variant="subtle"
      :links="[{
        label: 'Read The Dorean Principle',
        to: '/catalog/the-dorean-principle',
        trailingIcon: 'i-lucide-arrow-right'
      }, {
        label: 'Browse the catalog',
        to: '/catalog',
        color: 'neutral',
        variant: 'outline'
      }]"
    />
  </UContainer>
</template>
