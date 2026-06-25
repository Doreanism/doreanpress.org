<script setup lang="ts">
import { formatPrice, formatPounds } from '#shared/catalog'

const { lines, items, subtotalCents, totalWeightOz, isEmpty, setQuantity, remove } = useCart()
const toast = useToast()
const loading = ref(false)

useSeoMeta({ title: 'Your cart', description: 'Review your order from Dorean Press.' })

async function checkout() {
  if (isEmpty.value) return
  loading.value = true
  try {
    const { url } = await $fetch<{ url: string | null }>('/api/checkout', {
      method: 'POST',
      body: { items: items.value }
    })
    if (url) {
      await navigateTo(url, { external: true })
    } else {
      throw new Error('No checkout URL returned')
    }
  } catch (err) {
    console.error(err)
    toast.add({
      title: 'Checkout failed',
      description: 'We could not start checkout. Please try again.',
      icon: 'i-lucide-triangle-alert',
      color: 'error'
    })
    loading.value = false
  }
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Your cart"
    />

    <div
      v-if="isEmpty"
      class="mt-12 flex flex-col items-center gap-4 text-center"
    >
      <UIcon
        name="i-lucide-shopping-cart"
        class="size-12 text-dimmed"
      />
      <p class="text-lg text-muted">
        Your cart is empty.
      </p>
      <UButton
        to="/catalog"
        label="Browse the catalog"
        color="primary"
        trailing-icon="i-lucide-arrow-right"
      />
    </div>

    <div
      v-else
      class="mt-10 grid gap-10 lg:grid-cols-[3fr_2fr]"
    >
      <!-- Line items -->
      <ul
        role="list"
        class="divide-y divide-default rounded-lg ring ring-default"
      >
        <li
          v-for="line in lines"
          :key="line.slug"
          class="flex gap-4 p-4"
        >
          <NuxtLink :to="`/catalog/${line.slug}`">
            <img
              :src="line.book.cover"
              :alt="line.book.title"
              class="h-28 w-auto rounded ring ring-default"
            >
          </NuxtLink>

          <div class="flex flex-1 flex-col justify-between gap-4">
            <div>
              <NuxtLink
                :to="`/catalog/${line.slug}`"
                class="font-display font-semibold text-highlighted hover:text-primary"
              >
                {{ line.book.title }}
              </NuxtLink>
              <p class="text-sm text-muted">
                {{ line.book.author }}
              </p>

              <dl class="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt class="font-medium text-muted">
                  pages
                </dt>
                <dd class="text-toned">
                  {{ line.book.lulu.pageCount }}
                </dd>
                <dt class="font-medium text-muted">
                  dimensions
                </dt>
                <dd class="text-toned">
                  {{ line.book.dimensions }}
                </dd>
                <dt class="font-medium text-muted">
                  weight
                </dt>
                <dd class="text-toned">
                  {{ line.book.weightOz }} ounces
                </dd>
                <dt class="font-medium text-muted">
                  price
                </dt>
                <dd class="text-toned">
                  {{ formatPrice(line.book.priceCents, line.book.currency) }}
                </dd>
              </dl>
            </div>

            <div class="flex flex-col gap-2">
              <div class="flex items-center gap-3">
                <UInputNumber
                  :model-value="line.quantity"
                  :min="1"
                  :max="99"
                  size="sm"
                  class="w-24"
                  @update:model-value="(v: number) => setQuantity(line.slug, v)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  aria-label="Remove"
                  @click="remove(line.slug)"
                />
              </div>
              <p class="text-sm">
                <span class="font-medium text-muted">total weight</span>
                <span class="ml-3 text-toned">{{ formatPounds(line.lineWeightOz) }}</span>
              </p>
            </div>
          </div>

          <div class="font-display font-semibold text-highlighted">
            {{ formatPrice(line.lineTotalCents, line.book.currency) }}
          </div>
        </li>
      </ul>

      <!-- Summary -->
      <div class="h-fit rounded-lg ring ring-default bg-default p-6">
        <h2 class="font-display text-lg font-semibold text-highlighted">
          Order summary
        </h2>

        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-muted">
              Subtotal
            </dt>
            <dd class="text-highlighted">
              {{ formatPrice(subtotalCents) }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">
              Total weight
            </dt>
            <dd class="text-highlighted">
              {{ formatPounds(totalWeightOz) }}
            </dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-muted">
              Shipping
            </dt>
            <dd class="text-muted">
              calculated at checkout
            </dd>
          </div>
        </dl>

        <USeparator class="my-4" />

        <UButton
          label="Proceed to payment"
          icon="i-lucide-lock"
          color="primary"
          size="lg"
          block
          :loading="loading"
          @click="checkout"
        />

        <USeparator
          label="can’t pay?"
          class="my-4"
        />

        <RequestFreeModal
          :books="lines.map(l => l.book)"
          trigger-label="Request free order"
        />

        <p class="mt-3 text-center text-xs text-muted">
          Secure payment by Stripe, or ask the community to sponsor your copy. Books are printed on demand and shipped at cost.
        </p>
      </div>
    </div>
  </UContainer>
</template>
