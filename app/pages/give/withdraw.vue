<script setup lang="ts">
import { findBook } from '#shared/catalog'
import type { PublicBookRequest } from '~~/server/utils/requests'

useSeoMeta({
  title: 'Remove your request',
  robots: 'noindex'
})

const route = useRoute()
const toast = useToast()

const id = computed(() => String(route.query.id || ''))
const removing = ref(false)

// Look up the request so the reader can confirm it's theirs before removing it.
const { data: request, error } = await useFetch<PublicBookRequest>(
  () => `/api/requests/${id.value}`,
  { immediate: !!id.value }
)

// A request is a whole order, so the confirmation lists every title in it.
const lines = computed(() =>
  (request.value?.items ?? [])
    .map(item => ({ item, book: findBook(item.slug) }))
    .filter((l): l is { item: typeof l.item, book: NonNullable<typeof l.book> } => Boolean(l.book)))

async function withdraw() {
  if (!id.value) return
  removing.value = true
  try {
    await $fetch(`/api/requests/${id.value}`, { method: 'DELETE' })
    await navigateTo('/give')
    toast.add({
      title: 'Book request deleted',
      description: 'It’s off the Give a Book board.',
      icon: 'i-lucide-check',
      color: 'primary'
    })
  } catch (err) {
    const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'Could not remove your request. Please try again.'
    toast.add({ title: 'Something went wrong', description: message, icon: 'i-lucide-triangle-alert', color: 'error' })
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Remove your request"
    />

    <div class="mt-10 max-w-xl">
      <!-- No id, or request not found / already sponsored -->
      <div
        v-if="!id || error"
        class="flex flex-col items-start gap-4 rounded-lg ring ring-default bg-default p-6"
      >
        <UIcon
          name="i-lucide-search-x"
          class="size-10 text-dimmed"
        />
        <p class="text-toned">
          We couldn’t find an open request to remove. It may have already been
          sponsored, or already withdrawn. If a sponsor has sent your copy, it’s
          on its way and can’t be cancelled.
        </p>
        <UButton
          to="/give"
          label="Back to Give a Book"
          color="neutral"
          variant="subtle"
        />
      </div>

      <!-- Confirm removal -->
      <div
        v-else-if="request"
        class="flex flex-col gap-5 rounded-lg ring ring-default bg-default p-6"
      >
        <p class="text-toned">
          Remove this request from the <em>Give a Book</em> board? Once removed,
          sponsors will no longer see it. You can submit a new request any time.
        </p>

        <div class="flex flex-col gap-3">
          <div
            v-for="line in lines"
            :key="line.item.slug"
            class="flex gap-4"
          >
            <img
              :src="line.book.cover"
              :alt="line.book.title"
              class="h-24 w-auto rounded ring ring-default"
            >
            <div class="min-w-0">
              <p class="font-display font-semibold text-highlighted">
                {{ line.book.title }}
              </p>
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
        </div>

        <blockquote class="border-l-2 border-primary/40 pl-3 text-sm text-toned italic">
          “{{ request.message }}”
        </blockquote>

        <div class="flex flex-wrap gap-3">
          <UButton
            label="Remove my request"
            icon="i-lucide-trash-2"
            color="error"
            :loading="removing"
            @click="withdraw"
          />
          <UButton
            to="/give"
            label="Keep it on the board"
            color="neutral"
            variant="subtle"
          />
        </div>
      </div>
    </div>
  </UContainer>
</template>
