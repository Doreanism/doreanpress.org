<script setup lang="ts">
const { count } = useCart()

// An identity challenge happens by leaving the site and coming back, so a
// failure surfaces as a flag on the return URL rather than a rejected fetch.
useChallengeFeedback()

// Reads "Orders" once there is somebody to have orders, "Sign in" before that.
// Both go to the same page, which asks for an address when it needs one — a
// separate /sign-in route would be a dead end for anyone already signed in.
const { signedIn, refresh } = useSignedIn()
// Resolved during SSR so the header renders the right word first time, rather
// than saying "Sign in" to a signed-in reader until the client catches up.
await useAsyncData('signed-in', () => refresh())

const nav = computed(() => [
  { label: 'Home', to: '/', icon: 'i-lucide-home' },
  { label: 'Catalog', to: '/catalog', icon: 'i-lucide-library' },
  { label: 'Give a Book', to: '/give', icon: 'i-lucide-gift' },
  { label: 'About', to: '/about', icon: 'i-lucide-heart-handshake' },
  signedIn.value
    ? { label: 'Orders', to: '/orders', icon: 'i-lucide-package' }
    : { label: 'Sign in', to: '/orders', icon: 'i-lucide-log-in' }
])

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
  <UApp :toaster="{ progress: false, position: 'bottom-right' }">
    <KonamiSpray />

    <UHeader>
      <template #left>
        <AppLogo size="size-8" />
      </template>

      <UNavigationMenu :items="nav" />

      <template #right>
        <AppSettings />

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
          <div class="max-w-md space-y-1">
            <AppLogo size="size-7" />
            <p class="text-sm text-muted">
              “Freely you have received; freely give.” — Matthew 10:8
            </p>
          </div>
        </UContainer>
      </template>

      <template #left>
        <p class="text-sm text-muted">
          Printed on demand, sold at cost.
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
