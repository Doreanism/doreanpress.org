<script setup lang="ts">
import RequestItemsEditor from '~/components/RequestItemsEditor.vue'

const { signedIn } = useSignedIn()

interface OrderLine {
  id: string
  titles: string[]
  status?: string
  deliveryStatus?: string
  trackingUrl?: string
  createdAt: string
  requesters?: unknown[]
}

const { data: orders, refresh: refreshOrders } = await useOrders()
const ungroupedRequests = computed(() => {
  const grouped = new Set(orders.value?.outstanding.flatMap(group => group.requests.map(request => request.id)) || [])
  return (orders.value?.requested || []).filter(request => !grouped.has(request.id))
})

/** Plain English for a request's fulfilment state. */
function shippingLabel(line: OrderLine): string {
  if (line.deliveryStatus && line.deliveryStatus !== 'unknown') return line.deliveryStatus.replaceAll('_', ' ')
  if (line.status === 'done') return 'Fulfillment complete; delivery updates pending'
  if (line.status === 'ordered') return 'Author copy ordered'
  if (line.status === 'funded_awaiting_order') return 'Funded, awaiting order'
  if (line.status === 'needs_attention') return 'Needs attention'
  if (line.status === 'cancelled') return 'Cancelled'
  if (line.trackingUrl) return 'Shipped'
  if (line.status === 'fulfilled') return 'Paid, being prepared'
  return 'Waiting for a giver'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <h1 class="sr-only">
      Orders
    </h1>

    <!-- Signed out: ask for an address, then for the code that lands in it. -->
    <div
      v-if="!signedIn || !signedIn.email"
      class="max-w-md"
    >
      <EmailSignIn @authenticated="refreshOrders" />
    </div>

    <!-- Signed-in requests, outstanding first. -->
    <div
      v-if="signedIn"
      class="flex flex-col gap-8"
    >
      <section
        class="flex flex-col gap-3"
      >
        <h2 class="font-display text-xl font-semibold text-highlighted">
          Requests
        </h2>

        <OutstandingRequests
          show-status
          editable-messages
          hide-heading
        />

        <p
          v-if="orders?.requested.length === 0"
          class="text-sm text-muted"
        >
          None yet.
        </p>

        <div
          v-for="line in ungroupedRequests"
          v-else
          :key="line.id"
          class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg ring ring-default bg-default p-4"
        >
          <div class="min-w-0">
            <div class="flex items-start gap-1">
              <p class="font-display font-semibold text-highlighted">
                {{ line.titles.join(', ') || 'Books no longer in the catalog' }}
              </p>
              <RequestItemsEditor
                v-if="line.status === 'open'"
                :request="line"
              />
            </div>
            <p class="text-sm text-muted">
              {{ formatDate(line.createdAt) }}
            </p>
          </div>

          <div class="flex items-center gap-3">
            <UBadge
              :label="shippingLabel(line)"
              color="neutral"
              variant="subtle"
            />
            <RequestRemoveButton
              v-if="line.status === 'open'"
              :request="line"
            />
            <UButton
              v-if="line.trackingUrl"
              :to="line.trackingUrl"
              external
              target="_blank"
              label="Track"
              icon="i-lucide-truck"
              color="neutral"
              variant="link"
              size="xs"
            />
          </div>
        </div>
      </section>
    </div>
  </UContainer>
</template>
