<script setup lang="ts">
useSeoMeta({ title: 'Checkout cancelled' })
</script>

<template>
  <UContainer class="py-20">
    <div class="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
      <div class="flex size-16 items-center justify-center rounded-full bg-elevated">
        <UIcon
          name="i-lucide-x"
          class="size-8 text-muted"
        />
      </div>

      <h1 class="font-display text-3xl font-semibold text-highlighted">
        Checkout cancelled
      </h1>

      <p class="text-lg text-toned">
        No payment was taken. Your cart is still saved if you’d like to try again.
      </p>

      <div class="mt-2 flex flex-wrap justify-center gap-3">
        <UButton
          to="/cart"
          label="Return to cart"
          color="primary"
          icon="i-lucide-shopping-cart"
        />
        <UButton
          to="/catalog"
          label="Keep browsing"
          color="neutral"
          variant="subtle"
        />
      </div>
    </div>
  </UContainer>
</template>
