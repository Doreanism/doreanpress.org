<script setup lang="ts">
const { count } = useCart()

const nav = [
  { label: 'Home', to: '/', icon: 'i-lucide-home' },
  { label: 'Catalog', to: '/catalog', icon: 'i-lucide-library' },
  { label: 'Give a Book', to: '/give', icon: 'i-lucide-gift' },
  { label: 'About', to: '/about', icon: 'i-lucide-heart-handshake' }
]

const title = 'Dorean Press'
const description = 'A publishing ministry recovering the conviction that the gospel is freely given. Books on the church and the commercialization of Christianity, printed on demand and sold at honest cost.'

useHead({
  titleTemplate: t => (t ? `${t} · Dorean Press` : 'Dorean Press'),
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: { lang: 'en' }
})

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink
          to="/"
          aria-label="Dorean Press home"
        >
          <AppLogo size="size-8" />
        </NuxtLink>
      </template>

      <UNavigationMenu :items="nav" />

      <template #right>
        <UColorModeButton />

        <UChip
          :text="count"
          :show="count > 0"
          size="2xl"
          color="primary"
        >
          <UButton
            to="/cart"
            icon="i-lucide-shopping-cart"
            color="neutral"
            variant="ghost"
            aria-label="Cart"
          />
        </UChip>
      </template>

      <template #body>
        <UNavigationMenu
          :items="nav"
          orientation="vertical"
          class="-mx-2.5"
        />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #top>
        <UContainer class="py-8">
          <div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="max-w-md space-y-1">
              <AppLogo size="size-7" />
              <p class="text-sm text-muted">
                “Freely you have received; freely give.” — Matthew 10:8
              </p>
            </div>
            <UNavigationMenu
              :items="nav"
              variant="link"
            />
          </div>
        </UContainer>
      </template>

      <template #left>
        <p class="text-sm text-muted">
          © {{ new Date().getFullYear() }} Dorean Press. Printed on demand, sold at cost.
        </p>
      </template>

      <template #right>
        <UButton
          to="/catalog"
          label="Browse the catalog"
          color="neutral"
          variant="ghost"
          trailing-icon="i-lucide-arrow-right"
        />
      </template>
    </UFooter>
  </UApp>
</template>
