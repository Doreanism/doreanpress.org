<script setup lang="ts">
const { signedIn } = useSignedIn()
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Email addresses"
      description="Manage the emails you use to sign in and receive updates."
    />

    <div
      v-if="!signedIn?.email"
      class="mt-10 max-w-md"
    >
      <EmailSignIn />
    </div>
    <div
      v-else
      class="mt-10 max-w-2xl"
    >
      <AccountEmails />
    </div>
  </UContainer>
</template>
