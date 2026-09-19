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
        to: '/about',
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

    <UPageSection>
      <UPageCTA
        :ui="{ title: 'font-display' }"
        title="Read freely. Give freely."
        description="Read The Doctrine of Simony online for free, or order a paperback at cost."
        variant="subtle"
        :links="[{
          label: 'View the book',
          to: '/catalog/the-doctrine-of-simony'
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
