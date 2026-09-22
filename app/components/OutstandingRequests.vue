<script setup lang="ts">
import { findBook } from '#shared/catalog'

const props = defineProps<{ slug?: string, compact?: boolean, hideHeading?: boolean, showStatus?: boolean, editableMessages?: boolean }>()
const { signedIn } = useSignedIn()
const { data: orders, status, error, refresh } = await useOrders()
const groups = computed(() => (orders.value?.outstanding || []).map((group) => {
  const quantities = new Map<string, number>()
  for (const request of group.requests) {
    for (const item of request.items) {
      if (!props.slug || item.slug === props.slug) {
        quantities.set(item.slug, (quantities.get(item.slug) || 0) + item.quantity)
      }
    }
  }
  return { ...group, items: [...quantities].map(([slug, quantity]) => ({ slug, quantity })) }
}).filter(group => group.items.length))
const copies = computed(() => groups.value.reduce((total, group) =>
  total + group.items.reduce((sum, item) => sum + item.quantity, 0), 0))

// Async data is a shallow ref: replace only the changed rows and their containers.
function updateMessage(updated: { id: string, message: string }) {
  if (!orders.value) return
  const update = <T extends { id: string, message: string }>(request: T): T =>
    request.id === updated.id ? { ...request, message: updated.message } : request
  orders.value = {
    ...orders.value,
    requested: orders.value.requested.map(update),
    outstanding: orders.value.outstanding.map(group =>
      group.requests.some(request => request.id === updated.id)
        ? { ...group, requests: group.requests.map(update) }
        : group
    )
  }
}

function label(request: { status: string, deliveryStatus?: string }) {
  if (request.deliveryStatus && request.deliveryStatus !== 'unknown') return request.deliveryStatus.replaceAll('_', ' ')
  const labels: Record<string, string> = {
    open: 'Waiting for a giver', fulfilled: 'Paid, being prepared',
    funded_awaiting_order: 'Funded, awaiting order', ordered: 'Author copy ordered',
    done: 'Fulfillment complete; delivery updates pending', needs_attention: 'Needs attention'
  }
  return labels[request.status] || request.status
}
</script>

<template>
  <div
    v-if="compact"
    class="text-center"
  >
    <ULink
      v-if="signedIn && copies > 0 && !error"
      to="/orders"
      class="text-sm text-muted underline decoration-dotted underline-offset-4 hover:text-highlighted"
    >
      {{ copies }} {{ copies === 1 ? 'copy' : 'copies' }} currently requested
    </ULink>
  </div>
  <section
    v-else-if="signedIn && (groups.length > 0 || status === 'pending' || error)"
    class="space-y-3"
    aria-live="polite"
  >
    <h2
      v-if="!hideHeading"
      class="font-display text-xl font-semibold text-highlighted"
    >
      Outstanding requests
    </h2>
    <p
      v-if="status === 'pending'"
      class="text-sm text-muted"
    >
      Loading your requests…
    </p>
    <div
      v-else-if="error"
      class="text-sm"
    >
      Could not load your requests.
      <UButton
        label="Try again"
        variant="link"
        @click="refresh()"
      />
    </div>
    <template v-else>
      <div
        v-for="group in groups"
        :key="group.id"
        class="flex flex-col gap-4 rounded-lg ring ring-default p-4 sm:flex-row sm:gap-6"
      >
        <div class="flex gap-3 sm:w-60 sm:shrink-0">
          <UIcon
            name="i-lucide-map-pin"
            class="mt-0.5 size-4 shrink-0 text-dimmed"
            aria-hidden="true"
          />
          <address class="text-sm not-italic text-muted">
            <span class="font-medium text-highlighted">{{ group.name }}</span><br>
            {{ [group.address.line1, group.address.line2].filter(Boolean).join(', ') }}<br>
            {{ [group.address.city, group.address.state, group.address.postalCode].filter(Boolean).join(', ') }} · {{ group.address.country }}
          </address>
        </div>
        <div class="min-w-0 flex-1 sm:border-l sm:border-default sm:pl-6">
          <div
            v-if="showStatus"
            class="divide-y divide-default"
          >
            <div
              v-for="request in group.requests"
              :key="request.id"
              class="py-3 first:pt-0 last:pb-0"
            >
              <div class="flex flex-wrap items-start justify-between gap-2">
                <ul class="min-w-0 space-y-1 text-sm font-medium text-highlighted">
                  <li
                    v-for="item in request.items"
                    :key="item.slug"
                  >
                    <span class="mr-1 text-muted">{{ item.quantity }} ×</span>
                    {{ findBook(item.slug)?.title || item.slug }}
                  </li>
                </ul>
                <UBadge
                  :label="label(request)"
                  color="neutral"
                  variant="subtle"
                />
              </div>
              <div class="mt-2 flex flex-wrap items-start gap-x-3 gap-y-2">
                <RequestMessageEditor
                  v-if="editableMessages && request.status === 'open'"
                  :request-id="request.id"
                  :message="request.message"
                  class="min-w-0 flex-1"
                  @saved="updateMessage"
                />
                <UButton
                  v-if="request.trackingUrl"
                  :to="request.trackingUrl"
                  external
                  target="_blank"
                  label="Track"
                  icon="i-lucide-truck"
                  variant="link"
                  size="xs"
                />
              </div>
            </div>
          </div>
          <ul
            v-else
            class="space-y-1 text-sm"
          >
            <li
              v-for="item in group.items"
              :key="item.slug"
            >
              <strong>{{ item.quantity }} ×</strong> {{ findBook(item.slug)?.title || item.slug }}
            </li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
