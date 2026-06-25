<script setup lang="ts">
import { findBook, formatPrice } from '#shared/catalog'
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
      description: 'Your sponsored copy is on its way to the press. The reader will receive it soon.',
      icon: 'i-lucide-heart',
      color: 'primary'
    })
    refresh()
  }
})

function bookFor(slug: string) {
  return findBook(slug)
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
      description="Some readers have asked for a copy they cannot pay for. Choose one and sponsor it — we’ll print it on demand and ship it directly to them. Freely you have received; freely give."
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
        <div
          v-if="bookFor(req.bookSlug)"
          class="flex gap-4"
        >
          <NuxtLink :to="`/catalog/${req.bookSlug}`">
            <img
              :src="bookFor(req.bookSlug)!.cover"
              :alt="bookFor(req.bookSlug)!.title"
              class="h-24 w-auto rounded ring ring-default"
            >
          </NuxtLink>
          <div class="min-w-0">
            <NuxtLink
              :to="`/catalog/${req.bookSlug}`"
              class="font-display font-semibold text-highlighted hover:text-primary"
            >
              {{ bookFor(req.bookSlug)!.title }}
            </NuxtLink>
            <p class="text-sm text-muted">
              {{ bookFor(req.bookSlug)!.author }}
            </p>
            <p class="mt-1 text-xs text-dimmed">
              Requested {{ formatDate(req.createdAt) }}
            </p>
          </div>
        </div>

        <blockquote class="flex-1 border-l-2 border-primary/40 pl-3 text-sm text-toned italic">
          “{{ req.message }}”
        </blockquote>

        <UButton
          :label="`Sponsor this copy · ${formatPrice(bookFor(req.bookSlug)?.priceCents ?? 0)}`"
          icon="i-lucide-gift"
          color="primary"
          block
          :loading="sponsoringId === req.id"
          :disabled="!bookFor(req.bookSlug)"
          @click="sponsor(req.id)"
        />
      </div>
    </div>
  </UContainer>
</template>
