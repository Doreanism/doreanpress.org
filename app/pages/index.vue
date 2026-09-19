<script setup lang="ts">
const { add } = useCart()

async function requestFreeCopy() {
  add('the-doctrine-of-simony')
  await navigateTo({ path: '/cart', query: { request: '1' } })
}

useSeoMeta({
  title: 'The Doctrine of Simony is now available',
  description: 'The Doctrine of Simony by Conley Owens is now available in paperback and free digital editions from Dorean Press.'
})
</script>

<template>
  <div>
    <section class="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-default py-12 sm:py-16">
      <div
        aria-hidden="true"
        class="absolute inset-0 -z-20"
      >
        <img
          src="/covers/the-doctrine-of-simony-plate.webp"
          alt=""
          class="h-full w-full scale-105 object-cover object-top opacity-70 saturate-90 contrast-105 dark:opacity-45 dark:saturate-60"
        >
      </div>
      <div
        aria-hidden="true"
        class="absolute inset-0 -z-10 bg-linear-to-r from-default/85 via-default/65 to-default/5 dark:from-default/90 dark:via-default/70 dark:to-default/20"
      />
      <div
        aria-hidden="true"
        class="absolute top-1/2 right-[-8rem] -z-10 h-[32rem] w-[32rem] -translate-y-1/2 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-700/15"
      />
      <div
        aria-hidden="true"
        class="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-primary/35 to-transparent"
      />

      <UContainer class="w-full">
        <div class="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)] lg:gap-20">
          <div class="max-w-3xl">
            <p class="mb-5 text-sm font-semibold tracking-[0.2em] text-primary uppercase">
              New from Dorean Press
            </p>
            <h1 class="font-display text-5xl leading-[0.95] font-semibold tracking-tight text-highlighted sm:text-7xl lg:text-8xl">
              The Doctrine of Simony
            </h1>
            <p class="mt-5 font-display text-2xl text-muted italic sm:text-3xl">
              A Theological Retrieval and Appraisal
            </p>
            <p class="mt-6 max-w-2xl text-lg/8 text-toned sm:text-xl/9">
              This work recovers the church’s historic teaching on buying and selling spiritual things, then brings it to bear on the practices of the church today.
            </p>
            <p class="mt-4 text-base font-medium text-highlighted">
              Now available in paperback and free digital editions.
            </p>

            <div class="mt-8 flex flex-wrap gap-3">
              <UButton
                to="https://simony.info"
                target="_blank"
                label="Read online"
                icon="i-lucide-book-open-text"
                size="xl"
              />
              <UButton
                to="https://www.amazon.com/dp/B0HKC6P7N6"
                target="_blank"
                label="Order on Amazon"
                icon="i-lucide-shopping-bag"
                size="xl"
                color="neutral"
                variant="subtle"
              />
              <UButton
                label="Request a free copy"
                icon="i-lucide-hand-heart"
                size="xl"
                color="neutral"
                variant="outline"
                @click="requestFreeCopy"
              />
            </div>
          </div>

          <NuxtLink
            to="/catalog/the-doctrine-of-simony"
            class="group mx-auto block w-full max-w-sm lg:justify-self-end"
            aria-label="View The Doctrine of Simony"
          >
            <img
              src="/covers/the-doctrine-of-simony.webp"
              alt="Cover of The Doctrine of Simony"
              class="mx-auto max-h-[68svh] w-auto rounded-md shadow-2xl ring ring-default transition duration-300 group-hover:-translate-y-1 group-hover:shadow-primary/15"
            >
          </NuxtLink>
        </div>
      </UContainer>
    </section>

    <UPageSection
      :ui="{ container: 'border-t border-default', title: 'font-display' }"
      title="The gospel is not for sale."
      description="Dorean Press is a publishing ministry recovering an old conviction — “freely you have received; freely give.” We print thoughtful books on the church and the commercialization of Christianity."
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
