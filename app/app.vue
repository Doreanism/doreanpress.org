<script setup lang="ts">
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
// Not during prerender. `/` is built once and served to everyone
// (see `routeRules`), so there is no reader to ask about at build time — asking
// anyway threw, and `nuxt build` failed on both pages. Even had it answered,
// baking one reader's header into shared static HTML is not a thing to want.
//
// On every other route this still resolves on the server, so a page that
// depends on it — /orders — renders right the first time. On the prerendered
// ones the same call runs on the client instead, because there is no payload
// waiting for it there.
if (!import.meta.prerender) {
  const { refresh } = useSignedIn()
  await useAsyncData('signed-in', () => refresh())
}

const development = import.meta.dev

const nav = [
  { label: 'Catalog', to: '/catalog', icon: 'i-lucide-library' },
  { label: 'Give a Book', to: '/give', icon: 'i-lucide-gift' }
]

const title = 'Dorean Press'
const description = 'A publishing ministry recovering the conviction that the gospel is freely given. Books on the church and the commercialization of Christianity, printed on demand.'

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

    <UHeader class="static">
      <template #left>
        <AppLogo size="h-8 w-auto" />
      </template>

      <UNavigationMenu :items="nav" />

      <template #right>
        <!--
          Signed out, this corner is a light/dark toggle and Sign in; signed
          in, it is the person menu, which holds appearance too. Either way the
          cart beside it is what you are buying.

          Rendered on the server: the reader is resolved above before any page
          renders, so the HTML already has the right shape and nothing flashes
          on refresh. The one exception is the prerendered `/`, which has no
          reader at build time — the menu holds an empty slot there until the
          client asks.
        -->
        <AppAccountMenu />
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

    <footer class="border-t border-default">
      <UContainer class="flex flex-col items-start gap-6 py-8 sm:flex-row sm:items-end sm:justify-between">
        <AppLogo size="h-9 w-auto sm:h-[52px]" />

        <div class="flex self-stretch flex-col items-end gap-3 sm:self-auto">
          <p class="text-sm text-muted">
            “Freely you have received; freely give.” — Matthew 10:8
          </p>

          <nav
            aria-label="Legal and contact"
            class="flex shrink-0 items-center justify-end gap-5"
          >
            <ULink
              to="/terms"
              class="text-sm text-muted hover:text-default"
            >
              Terms
            </ULink>
            <ULink
              to="/privacy"
              class="text-sm text-muted hover:text-default"
            >
              Privacy
            </ULink>
            <ULink
              to="mailto:info@doreanpress.org"
              class="text-sm text-muted hover:text-default"
            >
              info@doreanpress.org
            </ULink>
          </nav>
        </div>
      </UContainer>
    </footer>
    <DevMailpit v-if="development" />
  </UApp>
</template>
