<script setup lang="ts">
// Terms of sale, and the page registered with Meta as the app's Terms of
// Service URL (it pre-fills that field with facebook.com, which would show to
// readers in the login dialog).
//
// Everything here describes how the site already behaves — print on demand
// through Lulu, one open request per address, a sponsored request that can no
// longer be withdrawn. The one section that is a decision rather than a
// description is "If something goes wrong": nothing in the code sets a refund
// policy, so this states one. Change it here if the press wants a different one.
useSeoMeta({
  title: 'Terms',
  description: 'The terms on which Dorean Press sells and gives away books: pricing, printing, delivery, and what happens if something goes wrong.'
})

const updated = 'August 2026'
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Terms"
      description="What you can expect from us when you order a book, and what we ask in return."
    />

    <div class="mx-auto mt-10 max-w-3xl space-y-10 text-lg/8 text-toned">
      <p>
        These terms cover buying a book from Dorean Press, asking for one on the Give a Book board, and paying for someone else's. They are meant to be read, so they are short.
      </p>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          What we sell, and at what price
        </h2>
        <p>
          Every book is printed on demand through Lulu's print network and shipped directly to you. Nothing is warehoused. Prices cover printing, shipping, and the bare keeping of the press — we do not price for profit, and we do not run sales, because there is no margin to discount.
        </p>
        <p>
          Where a title allows it, the digital edition is free to download and always will be. Buying a printed copy is a convenience, not a condition of reading the book.
        </p>
        <p>
          We show prices before you pay and take payment through Stripe. If a price is listed wrongly we will tell you before printing and cancel the order rather than charge you the difference.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Printing and delivery
        </h2>
        <p>
          Because each copy is made when you order it, allow time for printing as well as shipping. Delivery estimates come from Lulu and are estimates, not promises — customs and couriers are not ours to command. Risk in a book passes to you on delivery.
        </p>
        <p>
          Get your shipping address right. An order already in printing cannot be redirected; write to us straight away and we will do what we can.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          If something goes wrong
        </h2>
        <p>
          If a book arrives damaged, misprinted, incomplete, or is simply not the book you ordered, tell us within 30 days of delivery and we will reprint it or refund it, whichever you prefer. We will not ask you to post it back.
        </p>
        <p>
          If a book never arrives, tell us and we will chase it, and reprint it if it is lost.
        </p>
        <p>
          What we cannot do is take back a book you have changed your mind about: it was made for you, and an unwanted copy cannot go back on a shelf we do not have. If you have ordered by mistake, write to us immediately — before printing begins we can usually cancel and refund in full.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Asking for a book
        </h2>
        <p>
          Anyone may ask for a book they cannot pay for, and we would rather you asked than went without. Two things are asked of you in return: attach a public account you actually hold, by signing in at that provider, and give an address a courier can reach. The account is shown on the board because a stranger is being asked to pay, and they are entitled to see who they are helping.
        </p>
        <p>
          One open request per address. Asking again for the same doorstep adds books to the request already there rather than starting a second one. You can withdraw an open request at any time; once someone has sponsored it, a book is already being printed and it can no longer be pulled.
        </p>
        <p>
          Please ask for what you will read. Requests we believe to be made in bad faith — resale, duplicate identities, addresses that are not yours — we will remove, and we would rather say that plainly than police it quietly.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Paying for someone else's book
        </h2>
        <p>
          Sponsoring a request is a gift, not a purchase: the book ships to the person who asked, and you receive a receipt rather than a parcel. Because the gift is paid straight into printing, a sponsorship cannot be reversed once the book is in production. You are not given the recipient's name, address, or email — only the public account they attached.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Copyright
        </h2>
        <p>
          The books remain the property of their authors and publishers, under whatever licence each title carries. Buying a copy buys you the copy. Where a title is offered freely, share it as freely as we gave it.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Reaching us
        </h2>
        <p>
          Anything at all — an order, a request, a mistake we have made: <ULink
            class="text-primary"
            to="mailto:hello@doreanpress.org"
          >hello@doreanpress.org</ULink>. What we do with your information is set out in our <ULink
            class="text-primary"
            to="/privacy"
          >privacy policy</ULink>.
        </p>
        <p class="text-base text-muted">
          Last updated {{ updated }}.
        </p>
      </section>
    </div>
  </UContainer>
</template>
