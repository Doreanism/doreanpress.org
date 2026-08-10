<script setup lang="ts">
const { count } = useCart()

// An identity challenge happens by leaving the site and coming back, so a
// failure surfaces as a flag on the return URL rather than a rejected fetch.
useChallengeFeedback()

// The account sits with the cart in the top right, not in the nav. Both are
// about *you* rather than about the press — what you are buying, what you have
// ordered — and the nav is the site's own sections. Keeping them together also
// means the signed-in state is in one predictable corner instead of moving
// around inside a list whose length changes with it.
//
// Only `refresh` is wanted here: the menu reads the state itself, and this is
// just the one place that resolves it before a page renders.
const { refresh } = useSignedIn()

// Not during prerender. `/` and `/about` are built once and served to everyone
// (see `routeRules`), so there is no reader to ask about at build time — asking
// anyway threw, and `nuxt build` failed on both pages. Even had it answered,
// baking one reader's header into shared static HTML is not a thing to want.
//
// On every other route this still resolves on the server, so a page that
// depends on it — /orders — renders right the first time. On the prerendered
// ones the same call runs on the client instead, because there is no payload
// waiting for it there.
if (!import.meta.prerender) {
  await useAsyncData('signed-in', () => refresh())
}

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
  <UApp :toaster="{ progress: false, position: 'bottom-right' }">
    <FreelyGiven />

    <UHeader>
      <template #left>
        <AppLogo size="size-8" />
      </template>

      <UNavigationMenu :items="nav" />

      <template #right>
        <!--
          Settings is the site, the account is you, the cart is what you are
          buying. Three buttons that do not trade places depending on who is
          looking.
        -->
        <AppSettings />

        <!--
          Client-only, because a prerendered page has no reader: `/` is one file
          served to everybody, so whatever this rendered at build time would be
          wrong for all but one of them. The fallback holds the slot so the
          corner does not jump as it resolves.
        -->
        <ClientOnly>
          <AppAccountMenu />

          <template #fallback>
            <UButton
              icon="i-lucide-circle-user-round"
              color="neutral"
              variant="ghost"
              disabled
              aria-hidden="true"
            />
          </template>
        </ClientOnly>

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
