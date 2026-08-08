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
const { signedIn, refresh } = useSignedIn()
// Resolved during SSR so the header renders the right icon first time, rather
// than showing a signed-in reader the signed-out one until the client catches up.
await useAsyncData('signed-in', () => refresh())

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
    <KonamiSpray />

    <UHeader>
      <template #left>
        <AppLogo size="size-8" />
      </template>

      <UNavigationMenu :items="nav" />

      <template #right>
        <AppSettings />

        <!--
          The account, beside the cart. One button and one icon in both states:
          it is the same place either way — your orders, which asks you to sign
          in when it does not yet know you.

          The icon does not change with the state, and that is deliberate. It
          first drew a log-in arrow when signed out, which is a picture of an
          action rather than of a thing, so the corner had no account icon in it
          for anybody not already signed in — exactly when you are most looking
          for one. A person is what this corner *is*; whether you are signed in
          belongs in the label and the chip.

          The label is on `aria-label` rather than on screen because its
          neighbours are icons too, and a lone worded button here would read as
          the important one.
        -->
        <UChip
          :show="Boolean(signedIn)"
          size="sm"
          color="primary"
        >
          <UButton
            to="/orders"
            icon="i-lucide-circle-user-round"
            color="neutral"
            variant="ghost"
            :aria-label="signedIn ? `Your orders — signed in as ${signedIn.email}` : 'Sign in to see your orders'"
            :title="signedIn ? signedIn.email : 'Sign in'"
          />
        </UChip>

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
