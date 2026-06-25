<script setup lang="ts">
const { clear } = useCart()

useSeoMeta({ title: 'Thank you', description: 'Your Dorean Press order is confirmed.' })

// Clear the cart once the customer lands back from a successful payment.
onMounted(() => clear())
</script>

<template>
  <UContainer class="py-20">
    <div class="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
      <div class="flex size-16 items-center justify-center rounded-full bg-primary/10">
        <UIcon
          name="i-lucide-check"
          class="size-8 text-primary"
        />
      </div>

      <h1 class="font-display text-3xl font-semibold text-highlighted">
        Thank you for your order
      </h1>

      <p class="text-lg text-toned">
        Your payment was received and your book is on its way to the press. We print each copy on demand through Lulu and ship it directly to you, so please allow some time for printing and delivery. A receipt is on its way to your email.
      </p>

      <p class="font-display text-muted italic">
        “Freely you have received; freely give.”
      </p>

      <div class="mt-2 flex flex-wrap justify-center gap-3">
        <UButton
          to="/catalog"
          label="Continue browsing"
          color="primary"
          trailing-icon="i-lucide-arrow-right"
        />
        <UButton
          to="/"
          label="Back home"
          color="neutral"
          variant="subtle"
        />
      </div>
    </div>
  </UContainer>
</template>
