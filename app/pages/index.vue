<script setup lang="ts">
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
      description="Dorean Press is a publishing ministry recovering an old conviction — “freely you have received; freely give.” We print thoughtful books on the church and the commercialization of Christianity."
      :links="[{
        label: 'Browse the catalog',
        to: '/catalog',
        size: 'xl'
      }, {
        label: 'Our conviction',
        to: '/#about',
        icon: 'i-lucide-heart-handshake',
        size: 'xl',
        color: 'neutral',
        variant: 'subtle'
      }]"
    />

    <UPageSection
      :ui="{ container: 'border-t border-default' }"
      :features="[{
        icon: 'i-lucide-gift',
        title: 'Freely given',
        description: 'We never put a paywall between a reader and the message of the gospel. Where we can, the digital edition is free to download.'
      }, {
        icon: 'i-lucide-printer',
        title: 'Printed on demand',
        description: 'Books are printed and shipped only when ordered, through Lulu’s global print network. No warehouses, no waste, no overstock.'
      }]"
    />

    <UPageSection
      id="about"
      :ui="{ title: 'font-display' }"
      title="Freely you have received; freely give."
      description="Dorean Press exists to publish good books on the church without selling the gospel they proclaim."
    >
      <div class="mx-auto max-w-3xl space-y-6 text-lg/8 text-toned">
        <p>
          Dorean Press is a small publishing ministry with a single conviction: the message of the gospel is a gift, and gifts are not sold. Our name comes from the Greek word <em class="font-display">dorean</em> — “freely, without payment” — the very word Christ uses when he sends out his disciples: <span class="font-display italic">“Freely you have received; freely give.”</span>
        </p>
        <p>
          That charge sits uneasily alongside a great deal of modern Christian publishing, where the teaching of the church is routinely placed behind a paywall and proclamation is repackaged as product. We believe there is a better, older way — one that distinguishes the <em>support</em> of gospel work from the <em>sale</em> of it.
        </p>
        <p>
          So we publish carefully chosen books on the church and the commercialization of Christianity, and we order them printed on demand through Lulu. Where we are able, the digital edition is free. Nothing about how we distribute a book should contradict what the book is for.
        </p>
      </div>
    </UPageSection>

    <UPageSection>
      <UPageCTA
        :ui="{ title: 'font-display' }"
        title="Read freely. Give freely."
        description="Read The Doctrine of Simony online for free, or order a paperback at cost."
        variant="subtle"
        :links="[{
          label: 'View the book',
          to: '/catalog/the-doctrine-of-simony'
        }]"
      />
    </UPageSection>
  </div>
</template>
