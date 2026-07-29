<script setup lang="ts">
import { findBook, formatPrice, sponsorTotalCents, type RequestItem } from '#shared/catalog'
import type { PublicBookRequest } from '~~/server/utils/requests'

useSeoMeta({
  title: 'Give a Book',
  description: 'Readers have asked for a copy they cannot pay for. Sponsor one, and we’ll print and ship it to them at cost.'
})

const route = useRoute()
const toast = useToast()
const sponsoringId = ref<string | null>(null)

const { data: requests, refresh } = await useFetch<PublicBookRequest[]>('/api/requests', {
  default: () => []
})

onMounted(() => {
  if (route.query.sponsored) {
    toast.add({
      title: 'Thank you for giving',
      description: 'The request you sponsored is on its way to the press. The reader will receive it soon.',
      icon: 'i-lucide-heart',
      color: 'primary'
    })
    refresh()
  }
})

/** Resolve a request's items to catalog entries, dropping anything unknown. */
function linesFor(items: RequestItem[]) {
  return items
    .map(item => ({ item, book: findBook(item.slug) }))
    .filter((l): l is { item: RequestItem, book: NonNullable<typeof l.book> } => Boolean(l.book))
}

/** A request is only sponsorable if we can still print something in it. */
function isSponsorable(items: RequestItem[]) {
  return linesFor(items).length > 0
}

function totalCopies(items: RequestItem[]) {
  return items.reduce((n, i) => n + i.quantity, 0)
}

async function sponsor(id: string) {
  sponsoringId.value = id
  try {
    const { url } = await $fetch<{ url: string | null }>(`/api/requests/${id}/sponsor`, { method: 'POST' })
    if (url) {
      await navigateTo(url, { external: true })
    } else {
      throw new Error('No checkout URL')
    }
  } catch (err) {
    const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Could not start checkout.'
    toast.add({ title: 'Sponsorship failed', description: message, icon: 'i-lucide-triangle-alert', color: 'error' })
    sponsoringId.value = null
    refresh()
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Give a Book"
      description="Some readers have asked for books they cannot pay for. Choose a request and sponsor it in full — we’ll print it on demand and ship it directly to them. Freely you have received; freely give."
    />

    <div
      v-if="!requests || requests.length === 0"
      class="mt-12 flex flex-col items-center gap-4 text-center"
    >
      <UIcon
        name="i-lucide-hand-heart"
        class="size-12 text-dimmed"
      />
      <p class="text-lg text-muted">
        No open requests right now. Check back soon — or
        <ULink
          to="/catalog"
          class="text-primary"
        >browse the catalog</ULink>.
      </p>
    </div>

    <div
      v-else
      class="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
    >
      <div
        v-for="req in requests"
        :key="req.id"
        class="flex flex-col gap-4 rounded-lg ring ring-default bg-default p-5"
      >
        <div class="flex flex-col gap-3">
          <div
            v-for="line in linesFor(req.items)"
            :key="line.item.slug"
            class="flex gap-4"
          >
            <NuxtLink :to="`/catalog/${line.item.slug}`">
              <img
                :src="line.book.cover"
                :alt="line.book.title"
                class="h-24 w-auto rounded ring ring-default"
              >
            </NuxtLink>
            <div class="min-w-0">
              <NuxtLink
                :to="`/catalog/${line.item.slug}`"
                class="font-display font-semibold text-highlighted hover:text-primary"
              >
                {{ line.book.title }}
              </NuxtLink>
              <p class="text-sm text-muted">
                {{ line.book.author }}
              </p>
              <p
                v-if="line.item.quantity > 1"
                class="text-sm text-toned"
              >
                {{ line.item.quantity }} copies
              </p>
            </div>
          </div>

          <p class="text-xs text-dimmed">
            Requested {{ formatDate(req.createdAt) }}
            <span v-if="req.items.length > 1">
              · {{ req.items.length }} titles, {{ totalCopies(req.items) }} copies
            </span>
          </p>
        </div>

        <blockquote class="flex-1 border-l-2 border-primary/40 pl-3 text-sm text-toned italic">
          “{{ req.message }}”
        </blockquote>

        <div class="flex flex-col gap-2">
          <UButton
            :label="`${req.items.length > 1 ? 'Sponsor this order' : 'Sponsor this copy'} · ${formatPrice(sponsorTotalCents(req.items))}`"
            icon="i-lucide-gift"
            color="primary"
            block
            :loading="sponsoringId === req.id"
            :disabled="!isSponsorable(req.items)"
            @click="sponsor(req.id)"
          />
          <p class="text-center text-xs text-dimmed">
            Covers {{ req.items.length > 1 ? 'every book in the request' : 'the book' }} plus shipping — the whole
            request is funded at once.
          </p>
          <UButton
            :to="`/give/withdraw?id=${req.id}`"
            label="This is my request — remove it"
            icon="i-lucide-trash-2"
            color="neutral"
            variant="link"
            size="xs"
            block
          />
        </div>
      </div>
    </div>
  </UContainer>
</template>
