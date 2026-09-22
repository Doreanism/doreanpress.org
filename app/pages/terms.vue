<script setup lang="ts">
useSeoMeta({
  title: 'Terms',
  description: 'How printed books, free-book requests, and donations work at Dorean Press.'
})

const updated = 'September 2026'
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Terms"
      description="How printed books, free-book requests, and donations work."
    />

    <div class="mx-auto mt-10 max-w-3xl space-y-10 text-lg/8 text-toned">
      <p>
        Dorean Press is a ministry of Lakewood Village Baptist Church, doing business as Silicon Valley Reformed Baptist Church. These terms cover this website and the Give a Book ministry.
      </p>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Printed books
        </h2>
        <p>
          We link to Amazon for printed books. If you buy one there, you are buying from Amazon under Amazon's prices, delivery terms, return policy, and privacy policy. Dorean Press does not receive your payment or shipping details from an ordinary Amazon purchase.
        </p>
        <p>
          Where we offer a free digital edition, it is free to download and share under the licence stated in the book. Buying a printed copy is never a condition of reading it.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Asking for a book
        </h2>
        <p>
          If you cannot afford a printed copy, you may ask for one on the Give a Book board. Tell the truth, ask only for books you mean to read, and give us an address where Amazon can deliver. We may remove duplicate, misleading, or resale requests.
        </p>
        <p>
          You must first sign in with a sign-in link sent to your email address, then attach a public account that is yours. The board shows that account, the books you asked for, and your message. It never shows your shipping name, address, phone number, or email address.
        </p>
        <p>
          You may withdraw an open request. If we have already placed the Amazon order, we may not be able to stop or redirect it.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Giving toward a book
        </h2>
        <p>
          Gifts are made to Lakewood Village Baptist Church for its Dorean Press book ministry. Zeffy handles the payment and sends the receipt. You receive no book or other goods in return.
        </p>
        <p>
          You may point us to a request you would like us to fill next. That is a recommendation, not a gift legally set aside for one person. The church keeps control of the funds and decides how to use them for the ministry. If the request closes, costs less than expected, or cannot be filled, we will use the money for another Give a Book request or another expense of the same ministry.
        </p>
        <p>
          Zeffy may invite you to add an optional contribution to Zeffy itself. That amount does not come to us, and you may set it to zero.
        </p>
        <p>
          Gifts are normally final once received. If you made a duplicate gift or entered the wrong amount, write to us promptly. We will help where we can, but we cannot promise a refund after the money has been used or an order has been placed.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Printing and delivery
        </h2>
        <p>
          We order author copies from Amazon by hand and send them to the requester. Printing and delivery times are estimates, not promises. Shipping costs and taxes vary, so the suggested gift may be a little more or less than the final order.
        </p>
        <p>
          If a ministry copy is lost, damaged, or misprinted, email us. We will work with Amazon and, where appropriate, order a replacement. Please do not send the book back unless we ask you to.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Copyright
        </h2>
        <p>
          Each book remains under the copyright and licence stated in that book. A printed purchase gives you the copy, not the copyright. A free digital edition may be shared only as its licence allows.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Contact
        </h2>
        <p>
          Questions, mistakes, or delivery problems: <ULink
            class="text-primary"
            to="mailto:info@doreanpress.org"
          >info@doreanpress.org</ULink>. Our <ULink
            class="text-primary"
            to="/privacy"
          >privacy policy</ULink> explains what we do with personal information.
        </p>
        <p class="text-base text-muted">
          Lakewood Village Baptist Church · EIN 94-2878622 · Last updated {{ updated }}.
        </p>
      </section>
    </div>
  </UContainer>
</template>
