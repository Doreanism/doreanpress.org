<script setup lang="ts">
import {
  coversWholeRequest,
  findBook,
  formatPrice,
  itemsCopies,
  sponsorTotalCents,
  type RequestItem
} from '#shared/catalog'
import { isSameAccount } from '#shared/identity'
import type { PublicBookRequest } from '~~/server/utils/requests'

useSeoMeta({
  title: 'Give a Book',
  description: 'Readers have asked for a copy they cannot pay for. Sponsor one, and we’ll print and ship it to them at cost.'
})

const route = useRoute()
const toast = useToast()
const sponsoringId = ref<string | null>(null)

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

// A sponsor can cover a whole order or pick out part of it, so every card
// carries its own selection — seeded with everything the reader asked for, since
// giving the lot is the common case.
const picks = reactive<Record<string, RequestItem[]>>({})

watch(requests, (list) => {
  for (const req of list ?? []) {
    if (!picks[req.id]) picks[req.id] = linesFor(req.items).map(l => ({ ...l.item }))
  }
}, { immediate: true })

function selection(req: PublicBookRequest): RequestItem[] {
  return picks[req.id] ?? req.items
}

/** How the sponsor button reads, given how much of the request is picked. */
function sponsorLabel(req: PublicBookRequest) {
  const chosen = selection(req)
  const price = formatPrice(sponsorTotalCents(chosen))
  if (chosen.length === 0) return 'Pick a book to sponsor'
  if (coversWholeRequest(req.items, chosen)) {
    return `${req.items.length > 1 ? 'Sponsor this order' : 'Sponsor this copy'} · ${price}`
  }
  const copies = itemsCopies(chosen)
  return `Sponsor ${copies} of ${itemsCopies(req.items)} copies · ${price}`
}

async function sponsor(id: string) {
  const chosen = picks[id]
  if (chosen && chosen.length === 0) return
  sponsoringId.value = id
  try {
    const { url } = await $fetch<{ url: string | null }>(`/api/requests/${id}/sponsor`, {
      method: 'POST',
      body: { items: chosen }
    })
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

// Taking your own posting down is one click when the proof already in hand is
// the account that made it. The withdraw page stays for everything else: a proof
// that has lapsed, a different account, or the link in the confirmation email.
const { identity } = useIdentityProof()
const removingId = ref<string | null>(null)

function isMine(req: PublicBookRequest) {
  return Boolean(req.requester) && isSameAccount(identity.value, req.requester)
}

async function removeMine(req: PublicBookRequest) {
  removingId.value = req.id
  try {
    await $fetch(`/api/requests/${req.id}`, { method: 'DELETE' })
    await refresh()
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
      description="Some readers have asked for books they cannot pay for. Sponsor a whole request, or just the books you can — we print on demand and ship straight to them, and anything left over stays here for the next giver. Freely you have received; freely give."
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
        <!-- The account leads the card: it is who the sponsor is giving to. -->
        <RequesterBadge :requester="req.requester" />

        <div class="flex flex-col gap-3">
          <RequestBooks
            :items="req.items"
            :model-value="selection(req)"
            selectable
            @update:model-value="(v: RequestItem[]) => picks[req.id] = v"
          />

          <p class="text-xs text-dimmed">
            Requested {{ formatDate(req.createdAt) }}
            <span v-if="req.items.length > 1">
              · {{ req.items.length }} titles, {{ itemsCopies(req.items) }} copies
            </span>
          </p>
        </div>

        <RequestMessage :message="req.message" />

        <div class="flex flex-col gap-2">
          <UButton
            :label="sponsorLabel(req)"
            icon="i-lucide-gift"
            color="primary"
            block
            :loading="sponsoringId === req.id"
            :disabled="!isSponsorable(req.items) || selection(req).length === 0"
            @click="sponsor(req.id)"
          />
          <p class="text-center text-xs text-dimmed">
            <template v-if="selection(req).length === 0">
              Tick the books you’d like to cover — any you leave stay on the board for someone else.
            </template>
            <template v-else-if="coversWholeRequest(req.items, selection(req))">
              Covers {{ req.items.length > 1 ? 'every book in the order' : 'the book' }} plus shipping, printed and
              shipped in one parcel.
            </template>
            <template v-else>
              Covers just the books you picked, plus shipping. The rest stays on the board for someone else.
            </template>
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
