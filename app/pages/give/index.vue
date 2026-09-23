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
const handoff = ref<{ url: string, embed: boolean, recommendation: string, question: string, items: RequestItem[], estimatedCents: number | null, targetCents: number, fundedCents: number, expiresAt: string, resumed: boolean } | null>(null)
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
const giftAmount = computed(() => handoff.value?.estimatedCents == null ? 'Estimate unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((handoff.value?.estimatedCents || 0) / 100))
const giftRequestId = ref<string | null>(null)
const reservationEnded = ref(false)
const renewalFailed = ref(false)
let renewing = false
let heartbeat: ReturnType<typeof setInterval> | undefined
let leaving = false

function releaseGift() {
  leaving = true
  clearInterval(heartbeat)
  if (!handoff.value || !giftRequestId.value || reservationEnded.value) return
  const url = `/api/requests/${giftRequestId.value}/release`
  const body = JSON.stringify({ recommendation: handoff.value.recommendation })
  // Unlike ordinary requests, beacons can finish after a tab closes. A crashed
  // browser still releases its hold through the normal reservation expiry.
  const queued = navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))
  if (!queued) {
    void fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {})
  }
}

function restoreGiftPage() {
  leaving = false
  clearInterval(heartbeat)
  heartbeat = setInterval(keepGiftAlive, 45_000)
  void keepGiftAlive()
}

async function keepGiftAlive() {
  const current = handoff.value
  const id = giftRequestId.value
  if (!current || !id || reservationEnded.value || renewing || leaving) return
  renewing = true
  try {
    const result = await $fetch(`/api/requests/${id}/keep-alive`, {
      method: 'POST', body: { recommendation: current.recommendation }
    })
    if (handoff.value !== current) return
    current.expiresAt = result.expiresAt
    if (result.targetCents !== null) {
      current.targetCents = result.targetCents
      current.fundedCents = result.fundedCents
      current.estimatedCents = Math.max(0, result.targetCents - result.fundedCents)
    }
    renewalFailed.value = false
  } catch (err) {
    if (handoff.value !== current) return
    const status = (err as { statusCode?: number }).statusCode
    reservationEnded.value = status === 403 || status === 409 || Date.now() >= Date.parse(current.expiresAt)
    renewalFailed.value = true
  } finally {
    renewing = false
  }
}

onMounted(() => {
  heartbeat = setInterval(keepGiftAlive, 45_000)
  window.addEventListener('focus', keepGiftAlive)
  window.addEventListener('pagehide', releaseGift)
  window.addEventListener('pageshow', restoreGiftPage)
})
onBeforeUnmount(() => {
  releaseGift()
  window.removeEventListener('focus', keepGiftAlive)
  window.removeEventListener('pagehide', releaseGift)
  window.removeEventListener('pageshow', restoreGiftPage)
})

async function copyGiftValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${label} copied`, icon: 'i-lucide-copy', color: 'primary' })
  } catch {
    toast.add({ title: `Select the ${label.toLowerCase()} and copy it`, color: 'neutral' })
  }
}

// One card per order, and a reader has one open order per address: asking again
// for the same doorstep adds the books to what is already here rather than
// posting a second time. So a card is everything one reader is waiting for.
const { data: requests, refresh, status } = await useFetch<PublicBookRequest[]>('/api/requests', {
  default: () => []
})

const requestAnchor = (id: string) => `request-${id}`
const linkedId = ref('')
const linkedRequestMissing = computed(() => linkedId.value && status.value === 'success'
  && !requests.value.some(request => request.id === linkedId.value))

async function revealLinkedRequest() {
  linkedId.value = route.hash.startsWith('#request-') ? route.hash.slice('#request-'.length) : ''
  if (!linkedId.value) return
  await nextTick()
  document.getElementById(requestAnchor(linkedId.value))?.scrollIntoView({ block: 'start' })
}

onMounted(() => {
  revealLinkedRequest()
  watch([() => route.hash, requests], revealLinkedRequest, { flush: 'post' })
})

async function copyRequestLink(id: string) {
  const url = new URL('/give', window.location.origin)
  url.hash = requestAnchor(id)
  try {
    await navigator.clipboard.writeText(url.href)
    toast.add({ title: 'Request link copied', icon: 'i-lucide-link', color: 'primary' })
  } catch {
    // The anchor still opens, so the address bar and link menu remain usable.
    toast.add({ title: 'Copy the link from your address bar', color: 'neutral' })
  }
}

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

async function sponsor(id: string) {
  sponsoringId.value = id
  try {
    handoff.value = await $fetch(`/api/requests/${id}/sponsor`, { method: 'POST' })
    giftRequestId.value = id
    reservationEnded.value = false
    renewalFailed.value = false
    await keepGiftAlive()
    await nextTick()
    document.getElementById('gift-checkout')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    sponsoringId.value = null
  } catch (err) {
    const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Could not start checkout.'
    toast.add({ title: 'Could not open the gift form', description: message, icon: 'i-lucide-triangle-alert', color: 'error' })
    sponsoringId.value = null
    refresh()
  }
}

// Show request management when the attached profiles establish ownership.
const { identities } = useIdentityProof()
function isMine(req: PublicBookRequest) {
  return sharesAccount(identities.value, req.requesters)
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ root: 'border-0', title: 'font-display' }"
      title="Give a Book"
    />

    <p
      v-if="linkedRequestMissing"
      role="status"
      class="mt-6 rounded-lg bg-elevated p-4 text-sm text-muted"
    >
      This request is no longer available. You can browse the other open requests below.
    </p>

    <div
      v-if="handoff"
      id="gift-checkout"
      class="mt-6 scroll-mt-24 rounded-lg ring ring-default p-5 space-y-3"
    >
      <div class="space-y-3 border-b border-default pb-5">
        <h2 class="font-semibold">
          Books for this request code
        </h2>
        <RequestBooks :items="handoff.items" />
        <p class="text-sm text-muted">
          {{ itemsCopies(handoff.items) }} {{ itemsCopies(handoff.items) === 1 ? 'copy' : 'copies' }} total
        </p>
      </div>
      <p class="text-sm text-muted">
        Copy these values into the gift form below.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-lg bg-primary/10 p-5 ring ring-primary/25">
          <p class="text-sm font-medium">
            Request code
          </p>
          <div class="mt-2 flex items-center justify-between gap-3">
            <strong class="break-all font-mono text-2xl tracking-wide">{{ handoff.recommendation }}</strong>
            <UButton
              aria-label="Copy request code"
              icon="i-lucide-copy"
              color="primary"
              variant="soft"
              @click="copyGiftValue(handoff.recommendation, 'Request code')"
            />
          </div>
          <p class="mt-2 text-xs text-muted">
            Enter in “{{ handoff.question }}”.
          </p>
        </div>
        <div class="rounded-lg bg-primary/10 p-5 ring ring-primary/25">
          <p class="text-sm font-medium">
            Amount still needed
          </p>
          <div class="mt-2 flex items-center justify-between gap-3">
            <strong class="text-3xl tabular-nums">{{ giftAmount }}</strong>
            <UButton
              v-if="handoff.estimatedCents !== null"
              aria-label="Copy suggested gift amount"
              icon="i-lucide-copy"
              color="primary"
              variant="soft"
              @click="copyGiftValue((handoff.estimatedCents / 100).toFixed(2), 'Amount')"
            />
          </div>
          <p
            v-if="handoff.estimatedCents !== null"
            class="mt-2 text-xs text-muted"
          >
            Estimated printing, shipping, and tax · USD
          </p>
          <p
            v-else
            class="mt-2 text-xs text-muted"
          >
            International shipping requires a separate estimate.
          </p>
        </div>
      </div>
      <p
        v-if="reservationEnded"
        role="status"
      >
        This reservation has ended or the request is no longer available. If you already completed your gift, please wait for confirmation. Otherwise, select “Gift these books” again to start a new reservation if the request is still available.
      </p>
      <p
        v-else-if="renewalFailed"
        role="status"
      >
        We couldn’t keep your reservation active. We’ll retry automatically. Your current reservation expires at {{ new Date(handoff.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }}.
      </p>
      <p class="text-sm text-muted">
        {{ money(handoff.fundedCents) }} of {{ money(handoff.targetCents) }} funded. Give any amount toward this request. We order once it is fully funded; any excess goes to the general fund.
      </p>
      <p class="text-sm text-muted">
        A gift without the code goes to the general fund.
      </p>
      <p class="text-xs leading-relaxed text-muted">
        Gifts to Dorean Press are processed through Zeffy. The official organization processing donations is “Lakewood Village Baptist Church,” so you’ll see that name on the form. See our <ULink
          to="/terms"
          class="text-primary"
        >terms</ULink>. Zeffy’s own contribution is optional and may be set to zero. No goods or services are provided to you in return for your gift.
      </p>
      <template v-if="!reservationEnded && handoff.embed">
        <!-- Zeffy's embed shows only the payment fields, so the form reads as part of this page. -->
        <div class="relative h-[1200px] w-full overflow-hidden rounded-lg">
          <iframe
            title="Gift form powered by Zeffy"
            :src="handoff.url"
            class="absolute inset-0 size-full border-0"
            allow="payment"
            allowpaymentrequest
            allowtransparency="true"
          />
        </div>
        <p class="text-xs text-dimmed">
          Form not loading? <ULink
            :to="handoff.url"
            target="_blank"
            class="text-primary"
          >Open it in a new tab</ULink>.
        </p>
      </template>
      <UButton
        v-else-if="!reservationEnded"
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
        :id="requestAnchor(req.id)"
        :key="req.id"
        class="request-card flex scroll-mt-24 flex-col gap-4 rounded-lg p-5"
        :class="linkedId === req.id ? 'ring-2 ring-primary bg-primary/5 shadow-lg' : 'ring ring-default bg-default'"
      >
        <!-- The account leads the card: it is who the sponsor is giving to. -->
        <RequesterBadge :requesters="req.requesters" />

        <div class="flex flex-col gap-3">
          <RequestBooks :items="req.items" />
          <p
            v-if="req.fundingTargetCents"
            class="text-sm text-muted"
          >
            {{ money(req.fundedCents || 0) }} of {{ money(req.fundingTargetCents) }} funded · {{ money(req.fundingTargetCents - (req.fundedCents || 0)) }} still needed
          </p>

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
            label="Gift these books"
            icon="i-lucide-gift"
            color="primary"
            block
            :loading="sponsoringId === req.id"
            :disabled="!isSponsorable(req.items)"
            @click="sponsor(req.id)"
          />
          <div class="flex items-center justify-end gap-1">
            <UButton
              :to="{ path: '/give', hash: `#${requestAnchor(req.id)}` }"
              aria-label="Copy link to this request"
              title="Copy link to this request"
              icon="i-lucide-link"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="copyRequestLink(req.id)"
            />
            <UButton
              v-if="isMine(req)"
              :to="{ path: '/orders', hash: `#${requestAnchor(req.id)}` }"
              aria-label="Edit my request"
              title="Edit my request"
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              size="sm"
            />
            <RequestRemoveButton
              v-if="isMine(req)"
              :request="req"
              @removed="refresh()"
            />
          </div>
        </div>
      </div>
    </div>
  </UContainer>
</template>
