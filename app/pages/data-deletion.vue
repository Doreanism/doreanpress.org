<script setup lang="ts">
useSeoMeta({
  title: 'Deleting your data',
  description: 'How to remove information you gave Dorean Press.'
})
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Deleting your data"
      description="What you can remove yourself, and what you can ask us to remove."
    />

    <div class="mx-auto mt-10 max-w-3xl space-y-8 text-lg/8 text-toned">
      <section class="space-y-3">
        <h2 class="font-display text-2xl text-highlighted">
          Remove an attached account
        </h2>
        <p>
          You can remove an attached public account when another remains. Add and verify a replacement before removing your last public account. To remove the final identity, withdraw your open requests and contact us to delete your reader account. We delete its attached verification records; completed donation, fulfillment, security, and accounting records may be retained.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="font-display text-2xl text-highlighted">
          Withdraw an open request
        </h2>
        <p>
          You can withdraw an open request from the Give a Book board. If we have already ordered the book, we may need to keep enough information to finish the delivery and keep an accurate record of it.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="font-display text-2xl text-highlighted">
          Ask us
        </h2>
        <p>
          Email <ULink
            class="text-primary"
            to="mailto:info@doreanpress.org"
          >info@doreanpress.org</ULink> from the address you used. Tell us whether you want to see, correct, or delete your information. We aim to answer within 30 days.
        </p>
        <p>
          We may keep donation, order, security, and accounting records when the church has a legal or practical reason to do so. Amazon, Zeffy, and our other providers keep their own records under their own policies, so deleting our copy does not delete theirs.
        </p>
      </section>

      <p class="text-base text-muted">
        See the <ULink
          class="text-primary"
          to="/privacy"
        >privacy policy</ULink> for the full list of what we collect and who receives it.
      </p>
    </div>
  </UContainer>
</template>
