<script setup lang="ts">
import type { BookRequest } from '~~/server/utils/requests'

definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: 'Fulfillment', robots: 'noindex, nofollow' })
const status = ref('funded_awaiting_order')
const visibility = ref('all')
const page = ref(0)
watch([status, visibility], () => {
  page.value = 0
})
const { data: tasks, refresh, error: listError } = await useFetch('/api/admin/fulfillment', { query: { status, visibility, page } })
const detail = ref<Pick<BookRequest, 'id' | 'items' | 'name' | 'phone' | 'address' | 'fulfillment'> | null>(null)
const error = ref('')
const busy = ref(false)
const authorize = ref(false)
const form = reactive({ carrier: 'UPS', trackingNumber: '', maximumUsd: 0, marketplace: 'https://www.amazon.com', paymentMethod: '', amazonOrderNumber: '', actualUsd: 0, estimatedDate: '', trackingUrl: '' })
const timer = ref<ReturnType<typeof setTimeout>>()
onBeforeUnmount(() => clearTimeout(timer.value))
async function open(id: string) {
  error.value = ''
  try {
    detail.value = await $fetch(`/api/admin/fulfillment/${id}`)
    authorize.value = false
    const f = detail.value?.fulfillment || {}
    Object.assign(form, { carrier: f.carrier || 'UPS', trackingNumber: f.trackingNumber || '', maximumUsd: (f.maximumCents || 0) / 100, marketplace: f.marketplace || 'https://www.amazon.com', paymentMethod: f.paymentMethod || '', amazonOrderNumber: f.amazonOrderNumber || '', actualUsd: (f.actualCents || 0) / 100, estimatedDate: f.estimatedDate || '', trackingUrl: f.trackingUrl || '' })
    clearTimeout(timer.value)
    timer.value = setTimeout(() => {
      detail.value = null
    }, 5 * 60_000)
  } catch (err) { error.value = (err as { data?: { statusMessage?: string } }).data?.statusMessage || 'Could not open task.' }
}
async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<{ text?: string }>(`/api/admin/fulfillment/${id}`, { method: 'POST', body: { ...form, maximumCents: Math.round(form.maximumUsd * 100), actualCents: Math.round(form.actualUsd * 100), ...extra, action } })
    if (result.text) await navigator.clipboard.writeText(result.text)
    await refresh()
    if (detail.value?.id === id) await open(id)
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } }).data?.statusMessage || 'Action failed. Please try again.'
  } finally { busy.value = false }
}
</script>

<template>
  <UContainer class="py-12 space-y-6">
    <h1 class="font-display text-3xl">
      Fulfillment
    </h1>
    <p>
      Sign in again from <NuxtLink
        to="/orders"
        class="underline"
      >Your orders</NuxtLink> when private details require a fresh sign-in.
    </p>
    <div class="flex gap-4">
      <USelect
        v-model="status"
        :items="['funded_awaiting_order', 'ordered', 'done', 'needs_attention', 'open', 'fulfilled', 'cancelled', 'all']"
        aria-label="Status"
      />
      <USelect
        v-model="visibility"
        :items="['all', 'hidden', 'public']"
        aria-label="Public visibility"
      />
    </div>
    <p
      v-if="error || listError"
      role="alert"
      class="text-error"
    >
      {{ error || listError?.statusMessage }}
    </p>
    <div class="flex gap-3">
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
    <p v-if="!tasks?.length">
      No matching orders.
    </p>
    <article
      v-for="task in tasks"
      :key="task.id"
      class="p-5 ring ring-default rounded-lg space-y-3"
    >
      <h2 class="font-semibold">
        {{ task.titles.join(', ') }} · {{ task.quantity }} {{ task.quantity === 1 ? 'copy' : 'copies' }} · {{ task.country }}
      </h2>
      <p class="text-sm">
        {{ task.id }} · {{ task.status.replaceAll('_', ' ') }} · {{ task.fundedAt || 'Not funded' }}
      </p>
      <p v-if="task.hidden">
        Hidden from public
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          label="Open details"
          :disabled="busy"
          @click="open(task.id)"
        />
        <UButton
          :label="task.claimedBy ? 'Claimed' : 'Claim task'"
          :disabled="busy || !!task.claimedBy"
          @click="act(task.id, 'claim')"
        />
        <UButton
          :label="task.hidden ? 'Restore to public' : 'Hide from public'"
          :disabled="busy"
          color="neutral"
          @click="act(task.id, 'visibility', { hidden: !task.hidden })"
        />
      </div>
      <div
        v-if="detail?.id === task.id"
        class="space-y-4 border-t border-default pt-4"
      >
        <p>{{ detail.name }} · {{ detail.phone }}</p>
        <p>{{ [detail.address.line1, detail.address.line2, detail.address.city, detail.address.state, detail.address.postalCode, detail.address.country].filter(Boolean).join(', ') }}</p>
        <UButton
          label="Copy address"
          :disabled="busy"
          @click="act(task.id, 'address')"
        />
        <div class="grid gap-3 sm:grid-cols-3">
          <UFormField label="Maximum spend (USD)">
            <UInput
              v-model.number="form.maximumUsd"
              type="number"
            />
          </UFormField>
          <UFormField label="Amazon marketplace URL">
            <UInput v-model="form.marketplace" />
          </UFormField>
          <UFormField label="Saved payment method label">
            <UInput
              v-model="form.paymentMethod"
              placeholder="Church Visa ending 1234"
            />
          </UFormField>
        </div>
        <UButton
          label="Save ordering details"
          :disabled="busy"
          @click="act(task.id, 'details')"
        />
        <UCheckbox
          v-model="authorize"
          :label="`I authorize this purchase up to USD ${Number(form.maximumUsd || 0).toFixed(2)}`"
        />
        <UButton
          label="Copy agent instructions"
          :disabled="busy"
          @click="act(task.id, 'instructions', { authorize })"
        />
        <div class="grid gap-3 sm:grid-cols-3">
          <UFormField label="Amazon order number">
            <UInput v-model="form.amazonOrderNumber" />
          </UFormField>
          <UFormField label="Actual cost (USD)">
            <UInput
              v-model.number="form.actualUsd"
              type="number"
            />
          </UFormField>
          <UFormField label="Estimated delivery">
            <UInput v-model="form.estimatedDate" />
          </UFormField>
        </div>
        <UButton
          label="Record Amazon order"
          :disabled="busy"
          @click="act(task.id, 'ordered')"
        />
        <UFormField label="HTTPS tracking URL">
          <UInput
            v-model="form.trackingUrl"
            class="w-full"
          />
        </UFormField>
        <UButton
          :label="form.trackingUrl ? 'Add tracking URL and mark done' : 'Remove tracking and reopen'"
          :disabled="busy"
          @click="act(task.id, 'tracking')"
        />
        <div class="flex flex-wrap gap-3">
          <UFormField label="Carrier">
            <USelect
              v-model="form.carrier"
              :items="['UPS', 'USPS', 'FedEx', 'DHLExpress', 'AmazonShipping']"
            />
          </UFormField>
          <UFormField label="Tracking number">
            <UInput v-model="form.trackingNumber" />
          </UFormField>
          <UButton
            label="Save carrier details"
            :disabled="busy"
            @click="act(task.id, 'carrier')"
          />
        </div>
        <p>Delivery: {{ detail.fulfillment?.deliveryStatus || 'unknown' }}. {{ detail.fulfillment?.trackerId ? 'Automatic updates enabled.' : 'Updates unavailable.' }}</p>
        <div class="flex gap-2">
          <UButton
            label="Needs attention"
            color="neutral"
            :disabled="busy"
            @click="act(task.id, 'needs_attention')"
          />
          <UButton
            label="Cancel task"
            color="error"
            :disabled="busy"
            @click="act(task.id, 'cancelled')"
          />
          <UButton
            label="Close private details"
            color="neutral"
            @click="detail = null"
          />
        </div>
      </div>
    </article>
  </UContainer>
</template>
