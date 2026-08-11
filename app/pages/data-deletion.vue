<script setup lang="ts">
// Registered with Meta as the app's "Data deletion instructions URL", and the
// same page will do for any other provider that asks for one.
//
// It exists as its own route rather than as an anchor on /privacy because Meta
// rejects a URL with a fragment in that field — and because a reviewer landing
// here should find the instructions, not have to hunt a long policy for them.
// The detail lives here; /privacy links to it.
useSeoMeta({
  title: 'Deleting your data',
  description: 'How to remove an account you attached, withdraw a request, or have Dorean Press erase everything it holds about you.'
})
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Deleting your data"
      description="Two things you can do yourself, and one you can ask us for."
    />

    <div class="mx-auto mt-10 max-w-3xl space-y-6 text-lg/8 text-toned">
      <section class="space-y-3">
        <h2 class="font-display text-2xl text-highlighted">
          Remove an account you attached
        </h2>
        <p>
          If you signed in with Facebook, X, GitHub or any other provider to put an account behind a book request, you can take it off again from the request form — one account, or all of them. What you remove is destroyed rather than hidden, and the proof behind it is burned at the same time.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="font-display text-2xl text-highlighted">
          Withdraw a request
        </h2>
        <p>
          An open request on the Give a Book board can be pulled by the person who posted it. That removes the request and the accounts shown with it. A request that has already been sponsored cannot be withdrawn — a book is already being printed — but write to us once it has arrived and we will erase the record.
        </p>
      </section>

      <section class="space-y-3">
        <h2 class="font-display text-2xl text-highlighted">
          Ask us to delete everything
        </h2>
        <p>
          Email <ULink
            class="text-primary"
            to="mailto:hello@doreanpress.org"
          >hello@doreanpress.org</ULink> from the address you used with us, and say what you want removed — an order, a sign-in, a request, or every trace of you we hold. We will delete it and write back to confirm, within 30 days. You can also ask for a copy of what we hold, or ask us to correct it.
        </p>
        <p>
          Two limits, stated plainly. The record of a completed order is kept as long as tax and accounting rules require, so a purchase cannot be erased outright until then. And once a book has been printed and posted, Lulu holds its own copy of the delivery address, and Stripe its own record of the payment, each under their own policy.
        </p>
      </section>

      <p class="text-base text-muted">
        For the fuller picture of what we collect and why, see our
        <ULink
          class="text-primary"
          to="/privacy"
        >privacy policy</ULink>.
      </p>
    </div>
  </UContainer>
</template>
