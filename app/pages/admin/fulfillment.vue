<script setup lang="ts">
import { findBook } from '#shared/catalog'
import type { BookRequest } from '~~/server/utils/requests'

definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Fulfillment', robots: 'noindex, nofollow' })
const status = ref('pending')
const page = ref(0)
watch(status, () => {
  page.value = 0
})
const { data: tasks, refresh, error: listError } = await useFetch('/api/admin/fulfillment', { query: { status, page } })
const detail = ref<(Pick<BookRequest, 'id' | 'items' | 'name' | 'phone' | 'address' | 'fulfillment'> & { fundedCents: number }) | null>(null)
const toast = useToast()
const error = ref('')
const busy = ref(false)
const loadingId = ref<string | null>(null)
const trackingUrl = ref('')
const actualUsd = ref('')
const privateOrderUrl = ref('')
const loginOpen = ref(false)
let retryAfterLogin: (() => Promise<unknown>) | null = null
function promptForLogin(err: unknown, retry: () => Promise<unknown>) {
  if ((err as { statusCode?: number })?.statusCode !== 401) return false
  retryAfterLogin = retry
  loginOpen.value = true
  clearTimeout(timer.value)
  return true
}
async function resumeAfterLogin() {
  loginOpen.value = false
  error.value = ''
  const retry = retryAfterLogin
  retryAfterLogin = null
  await retry?.()
}
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
async function save(id: string) {
  const amount = String(actualUsd.value).trim()
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    error.value = 'Enter a valid amount paid with no more than two decimal places.'
    return
  }
  await act(id, 'purchase', { privateOrderUrl: privateOrderUrl.value.trim(), actualCents: Math.round(Number(amount) * 100) })
}
const timer = ref<ReturnType<typeof setTimeout>>()
watch(listError, (err) => {
  if (err) promptForLogin(err, () => refresh())
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer.value))
async function open(id: string) {
  error.value = ''
  loadingId.value = id
  detail.value = null
  try {
    detail.value = await $fetch(`/api/admin/fulfillment/${id}`)
    trackingUrl.value = detail.value?.fulfillment?.trackingUrl || ''
    privateOrderUrl.value = detail.value?.fulfillment?.privateOrderUrl || ''
    actualUsd.value = detail.value?.fulfillment?.actualCents != null ? (detail.value.fulfillment.actualCents / 100).toFixed(2) : ''
    clearTimeout(timer.value)
    timer.value = setTimeout(() => {
      detail.value = null
    }, 5 * 60_000)
  } catch (err) {
    if (promptForLogin(err, () => open(id))) return
    error.value = (err as { data?: { statusMessage?: string } }).data?.statusMessage || 'Could not open order.'
  } finally { loadingId.value = null }
}
async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
  busy.value = true
  error.value = ''
  try {
    await $fetch(`/api/admin/fulfillment/${id}`, { method: 'POST', body: { action, ...extra } })
    detail.value = null
    await refresh()
    if (action === 'purchase' || action === 'claim') await open(id)
    toast.add({ title: action === 'tracking' ? (trackingUrl.value.trim() ? 'Order saved — fulfilled' : 'Tracking removed — order reopened') : action === 'purchase' ? 'Order details saved' : action === 'claim' ? 'Order claimed' : 'Visibility updated', color: 'success' })
  } catch (err) {
    if (promptForLogin(err, () => act(id, action, extra))) return
    error.value = (err as { data?: { statusMessage?: string } }).data?.statusMessage || 'Could not save changes.'
  } finally { busy.value = false }
}
</script>

<template>
  <UContainer class="py-12 space-y-6">
    <UModal
      v-model:open="loginOpen"
      title="Sign in to continue"
      description="Your session has expired. Sign in again to continue with this order."
    >
      <template #body>
        <EmailSignIn @authenticated="resumeAfterLogin" />
      </template>
    </UModal>
    <h1 class="font-display text-3xl">
      Order fulfillment
    </h1>
    <USelect
      v-model="status"
      :items="[{ label: 'To fulfill', value: 'pending' }, { label: 'Fulfilled', value: 'done' }, { label: 'Open requests', value: 'open' }]"
      aria-label="Show orders"
    />
    <p
      v-if="error || listError"
      role="alert"
      class="text-error"
    >
      {{ error || listError?.statusMessage }}
    </p>
    <p
      v-if="!tasks?.length"
      class="text-muted"
    >
      No orders here.
    </p>
    <article
      v-for="task in tasks"
      :key="task.id"
      class="p-5 ring ring-default rounded-lg space-y-4"
    >
      <h2
        v-if="detail?.id !== task.id"
        class="font-semibold"
      >
        {{ task.titles.join(', ') }} · {{ task.quantity }} {{ task.quantity === 1 ? 'copy' : 'copies' }}
      </h2>
      <p
        v-if="task.claimedBy"
        class="text-sm text-muted"
      >
        Claimed by {{ task.claimedEmail || 'an administrator' }}
      </p>
      <p
        v-if="task.status === 'ordered'"
        class="text-sm text-muted"
      >
        Ordered · awaiting tracking
      </p>
      <UButton
        v-if="!task.claimedBy && task.status !== 'open' && task.status !== 'done'"
        label="Claim order"
        color="neutral"
        variant="soft"
        :disabled="busy"
        @click="act(task.id, 'claim')"
      />
      <template v-if="detail?.id === task.id">
        <div
          v-for="item in detail.items"
          :key="item.slug"
          class="flex items-start justify-between gap-3"
        >
          <RequestBooks :items="[item]" />
          <div class="flex shrink-0 gap-1">
            <UTooltip text="View on Amazon">
              <UButton
                v-if="findBook(item.slug)?.amazonUrl"
                :to="findBook(item.slug)?.amazonUrl"
                target="_blank"
                rel="noopener noreferrer"
                icon="i-simple-icons-amazon"
                :aria-label="`View ${findBook(item.slug)?.title || item.slug} on Amazon`"
                color="neutral"
                variant="ghost"
              />
            </UTooltip>
            <UTooltip text="Order author copies">
              <UButton
                :to="findBook(item.slug)?.authorCopiesUrl || 'https://kdp.amazon.com/en_US/bookshelf'"
                target="_blank"
                rel="noopener noreferrer"
                icon="i-lucide-book-copy"
                :aria-label="`Order author copies of ${findBook(item.slug)?.title || item.slug} in KDP`"
                color="neutral"
                variant="ghost"
              />
            </UTooltip>
          </div>
        </div>
        <p class="text-sm">
          Given toward this order: <strong>{{ money(detail.fundedCents) }}</strong>
        </p>
        <div class="text-sm leading-relaxed">
          <p class="font-medium">
            {{ detail.name }}
          </p>
          <p>{{ detail.address.line1 }}</p>
          <p v-if="detail.address.line2">
            {{ detail.address.line2 }}
          </p>
          <p>{{ [detail.address.city, detail.address.state, detail.address.postalCode].filter(Boolean).join(', ') }}</p>
          <p>{{ detail.address.country }}</p>
          <p v-if="detail.phone">
            {{ detail.phone }}
          </p>
        </div>
        <p
          v-if="detail.fulfillment?.addressChangedAt"
          class="text-sm text-warning"
        >
          The shipping address has changed. Check it against any order already placed.
        </p>
        <form
          v-if="task.status !== 'open'"
          class="space-y-3"
          @submit.prevent="save(task.id)"
        >
          <UFormField
            label="Amount paid (USD)"
            description="Including shipping and tax."
          >
            <UInput
              v-model="actualUsd"
              type="number"
              min="0"
              step="0.01"
              placeholder="Not recorded"
              required
            />
          </UFormField>
          <UFormField
            label="Private Amazon order link"
            description="Visible only to administrators."
          >
            <UInput
              v-model="privateOrderUrl"
              type="url"
              placeholder="https://www.amazon.com/…"
              class="w-full"
              required
            />
          </UFormField>
          <div class="flex items-center gap-3">
            <UButton
              type="submit"
              label="Save order details"
              :loading="busy"
              :disabled="busy"
            />
            <ULink
              v-if="detail.fulfillment?.privateOrderUrl"
              :to="detail.fulfillment.privateOrderUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-sm text-primary"
            >
              Open Amazon order
            </ULink>
          </div>
        </form>
        <form
          v-if="detail.fulfillment?.privateOrderUrl || detail.fulfillment?.amazonOrderNumber || task.status === 'ordered' || task.status === 'done'"
          class="space-y-3 border-t border-default pt-4"
          @submit.prevent="act(task.id, 'tracking', { trackingUrl: trackingUrl.trim() })"
        >
          <UFormField
            label="Tracking URL"
            description="Add this when tracking becomes available."
          >
            <UInput
              v-model="trackingUrl"
              type="url"
              placeholder="https://…"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            :label="!trackingUrl.trim() && detail.fulfillment?.trackingUrl ? 'Remove tracking and reopen' : 'Save tracking'"
            :loading="busy"
            :disabled="busy || (!trackingUrl.trim() && !detail.fulfillment?.trackingUrl)"
          />
        </form>
      </template>
      <UButton
        v-else
        label="View order"
        color="neutral"
        variant="soft"
        :loading="loadingId === task.id"
        :disabled="busy || loadingId !== null"
        @click="open(task.id)"
      />
      <UButton
        v-if="task.status === 'open'"
        :label="task.hidden ? 'Restore to public' : 'Hide from public'"
        :disabled="busy"
        color="neutral"
        variant="ghost"
        @click="act(task.id, 'visibility', { hidden: !task.hidden })"
      />
    </article>
    <div
      v-if="page > 0 || (tasks?.length || 0) >= 200"
      class="flex gap-3"
    >
      <UButton
        label="Previous page"
        :disabled="page === 0"
        @click="page--"
      />
      <UButton
        label="Next page"
        :disabled="(tasks?.length || 0) < 200"
        @click="page++"
      />
    </div>
  </UContainer>
</template>
