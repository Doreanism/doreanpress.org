<script setup lang="ts">
import {
  findBook,
  itemsCopies,
  type RequestItem
} from '#shared/catalog'
import { sharesAccount } from '#shared/identity'
import type { PublicBookRequest } from '~~/server/utils/requests'

useSeoMeta({
  title: 'Give a Book',
  description: 'Give to the Dorean Press book ministry and recommend a reader’s request for an author copy.'
})

const route = useRoute()
const toast = useToast()
const sponsoringId = ref<string | null>(null)
const handoff = ref<{ url: string, recommendation: string, question: string } | null>(null)

// One card per order, and a reader has one open order per address: asking again
// for the same doorstep adds the books to what is already here rather than
// posting a second time. So a card is everything one reader is waiting for.
const { data: requests, refresh } = await useFetch<PublicBookRequest[]>('/api/requests', {
  default: () => []
})

onMounted(() => {
  if (route.query.sponsored) {
    toast.add({
      title: 'Thank you for giving',
      description: 'Thank you. We confirm gifts after Zeffy reports a completed payment.',
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

const picks = reactive<Record<string, RequestItem[]>>({})
watch(requests, (list) => {
  for (const req of list || []) picks[req.id] ??= req.items.map(item => ({ ...item }))
}, { immediate: true })

async function sponsor(id: string) {
  sponsoringId.value = id
  try {
    handoff.value = await $fetch(`/api/requests/${id}/sponsor`, { method: 'POST', body: { items: picks[id] } })
    sponsoringId.value = null
  } catch (err) {
    const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Could not start checkout.'
    toast.add({ title: 'Sponsorship failed', description: message, icon: 'i-lucide-triangle-alert', color: 'error' })
    sponsoringId.value = null
    refresh()
  }
}

// Taking your own posting down is one click when the proof already in hand is
// the account that made it. The withdraw page stays for everything else: a proof
// that has lapsed, a different account, or the link in the confirmation email.
const { identities } = useIdentityProof()
const removingId = ref<string | null>(null)

function isMine(req: PublicBookRequest) {
  return sharesAccount(identities.value, req.requesters)
}

async function removeMine(req: PublicBookRequest) {
  removingId.value = req.id
  try {
    await $fetch(`/api/requests/${req.id}`, { method: 'DELETE' })
    await Promise.all([refresh(), refreshNuxtData('orders')])
    toast.add({
      title: 'Off the board',
      description: 'Your request has been removed. You can ask again any time.',
      icon: 'i-lucide-check',
      color: 'primary'
    })
  } catch (err) {
    const failure = err as { statusCode?: number, data?: { statusMessage?: string } }
    // Only the withdraw page can raise a fresh challenge, so a lapsed proof is
    // handed over to it rather than dead-ending here.
    if (failure?.statusCode === 401) return navigateTo(`/give/withdraw?id=${req.id}`)
    toast.add({
      title: 'Could not remove it',
      description: failure?.data?.statusMessage || 'Please try again.',
      icon: 'i-lucide-triangle-alert',
      color: 'error'
    })
  } finally {
    removingId.value = null
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
      description="Give to Lakewood Village Baptist Church’s Dorean Press ministry through Zeffy. You may recommend a request; the church retains control and discretion over every gift. If a request cannot be filled, your gift remains in the book ministry."
    />

    <div
      v-if="handoff"
      class="mt-6 rounded-lg ring ring-default p-5 space-y-3"
    >
      <h2 class="font-semibold">
        Your recommendation
      </h2>
      <p>Copy this code into the “{{ handoff.question }}” field on Zeffy: <strong class="break-all">{{ handoff.recommendation }}</strong></p>
      <p>This request is reserved for 30 minutes. A late gift, or a gift without this code, goes to the general Give a Book balance.</p>
      <p>Zeffy’s own contribution is optional and may be set to zero. No goods or services are provided to you in return for your gift.</p>
      <UButton
        :to="handoff.url"
        target="_blank"
        label="Continue to Zeffy"
      />
    </div>

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
        <!-- The account leads the card: it is who the sponsor is giving to. -->
        <RequesterBadge :requesters="req.requesters" />

        <div class="flex flex-col gap-3">
          <RequestBooks
            :items="req.items"
            :model-value="picks[req.id] || req.items"
            selectable
            @update:model-value="(items: RequestItem[]) => picks[req.id] = items"
          />

          <p class="text-xs text-dimmed">
            Requested {{ formatDate(req.createdAt) }}
            <span v-if="req.items.length > 1">
              · {{ req.items.length }} titles, {{ itemsCopies(req.items) }} copies
            </span>
          </p>
        </div>

        <RequestMessage
          v-if="req.message"
          :message="req.message"
        />

        <div class="flex flex-col gap-2">
          <UButton
            label="Give and recommend these books"
            icon="i-lucide-gift"
            color="primary"
            block
            :loading="sponsoringId === req.id"
            :disabled="!isSponsorable(req.items) || picks[req.id]?.length === 0"
            @click="sponsor(req.id)"
          />
          <p class="text-center text-xs text-dimmed">
            Your recommendation helps us decide which request to fill next.
          </p>
          <UButton
            v-if="isMine(req)"
            label="This is my request — remove it"
            icon="i-lucide-trash-2"
            color="neutral"
            variant="link"
            size="xs"
            block
            :loading="removingId === req.id"
            @click="removeMine(req)"
          />
          <UButton
            v-else
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
