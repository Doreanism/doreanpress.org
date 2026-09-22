<script setup lang="ts">
import { findBook } from '#shared/catalog'
import type { GivenView } from '~~/server/utils/orderViews'

useSeoMeta({ title: 'Your gifts' })
const { signedIn } = useSignedIn()
const { data: gifts, status, error, refresh } = await useGifts()

function giftStatus(gift: GivenView) {
  const labels: Record<string, string> = {
    open: 'Waiting for a giver', fulfilled: 'Paid, being prepared',
    funded_awaiting_order: 'Funded, awaiting order', ordered: 'Author copy ordered',
    done: 'Fulfillment complete', needs_attention: 'Needs attention', cancelled: 'Cancelled'
  }
  return labels[gift.status] || gift.status
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <h1 class="mb-4 font-display text-xl font-semibold text-highlighted">
      Your gifts
    </h1>
    <EmailSignIn
      v-if="!signedIn"
      class="max-w-md"
      @authenticated="refresh"
    />
    <div
      v-else
      class="space-y-3"
    >
      <p
        v-if="status === 'pending'"
        class="text-sm text-muted"
      >
        Loading gifts…
      </p>
      <div
        v-else-if="error"
        class="text-sm text-muted"
      >
        Could not load your gifts.
        <UButton
          label="Try again"
          variant="link"
          @click="refresh()"
        />
      </div>
      <p
        v-else-if="!gifts?.length"
        class="text-sm text-muted"
      >
        No gifts yet.
      </p>
      <template v-else>
        <div
          v-for="gift in gifts"
          :key="gift.id"
          class="flex flex-wrap items-start justify-between gap-3 rounded-lg ring ring-default p-4"
        >
          <div class="min-w-0 space-y-2">
            <ul class="text-sm font-medium text-highlighted">
              <li
                v-for="item in gift.items"
                :key="item.slug"
              >
                {{ item.quantity }} × {{ findBook(item.slug)?.title || item.slug }}
              </li>
            </ul>
            <RequesterBadge :requesters="gift.requesters" />
            <p class="text-sm text-muted">
              {{ formatDate(gift.fulfilledAt || gift.createdAt) }}
            </p>
          </div>
          <UBadge
            :label="giftStatus(gift)"
            color="neutral"
            variant="subtle"
          />
        </div>
      </template>
    </div>
  </UContainer>
</template>
