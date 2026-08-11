<script setup lang="ts">
// The privacy policy, and the page Meta and the other OAuth providers are
// pointed at when they ask for one. Two things are load-bearing here and should
// not drift from the code:
//
//   - the "What is public" section describes `toPublic` in
//     `server/utils/requests.ts`. If a field moves across that line, it moves
//     here too.
//   - the deletion promises here are the same ones /data-deletion makes, and
//     that page is what Meta has registered as the app's data deletion
//     instructions URL (Meta rejects a URL with a fragment, so the anchor below
//     is for readers only). If one changes, change both.
useSeoMeta({
  title: 'Privacy',
  description: 'What Dorean Press collects, what it shows publicly, who it shares with, and how to have it deleted.'
})

const updated = 'August 2026'

// The providers actually wired up in `server/routes/verify/`. Bluesky is in the
// list because it is always offered — it needs no credentials.
const providers = 'X, Facebook, LinkedIn, GitHub, GitLab, Twitch, TikTok and Bluesky'
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Privacy"
      description="What we collect, what we show, who we share it with, and how to have it deleted."
    />

    <div class="mx-auto mt-10 max-w-3xl space-y-10 text-lg/8 text-toned">
      <p>
        Dorean Press is a small publishing ministry, not an advertising business. We collect what it takes to print a book and put it in your hands, and we would rather hold less than more. We do not sell your information, we do not share it for advertising, and there are no analytics or tracking scripts on this site.
      </p>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          What we collect
        </h2>
        <p>
          <strong class="text-highlighted">When you buy a book.</strong> Your name, email address, and shipping address, plus what you ordered and what it cost. Payment is handled entirely by Stripe — card numbers are entered on Stripe's systems and never reach ours. We store the Stripe session id so we can match an order to its payment.
        </p>
        <p>
          <strong class="text-highlighted">When you ask for a free book.</strong> The same name, email, phone and shipping address a courier needs, along with your message and the books you asked for.
        </p>
        <p>
          <strong class="text-highlighted">When you attach a public account.</strong> Before a request goes on the Give a Book board, you sign in at a provider ({{ providers }}) to prove the account is yours. We receive and store that provider's id for the account, the display name, and — where the provider offers them — your handle, profile link, avatar URL, verified badge, and the date the account was opened. Some providers also hand us your email address, which we use only to prefill the request form.
        </p>
        <p>
          <strong class="text-highlighted">When you sign in.</strong> We email a one-time code and store a hash of it, with its expiry, until it is used or expires. Signing in identifies an inbox so we can show you your own orders; it is not a profile, and there is nothing else attached to it.
        </p>
        <p>
          <strong class="text-highlighted">Cookies.</strong> One, called <code class="text-sm">dorean-identity-proof</code>. It is sealed and holds your completed account checks and your sign-in. Nothing on this site is used for advertising or cross-site tracking.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          What is public
        </h2>
        <p>
          The Give a Book board is public, because a stranger is being asked to pay for someone else's book and deserves to see who they are helping. A request on the board shows the books asked for, the message written, and the public accounts attached to it — the name, handle, profile link and avatar the provider gives.
        </p>
        <p>
          Your shipping name, address, phone number and email address are never shown on the board and are never given to a sponsor. A sponsor pays; they do not learn where the parcel goes.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Who we share it with
        </h2>
        <p>
          Only the services it takes to run the press, and only what each one needs:
        </p>
        <ul class="list-disc space-y-2 pl-6">
          <li><strong class="text-highlighted">Stripe</strong> — payments. Handles your card details directly; we never see them.</li>
          <li><strong class="text-highlighted">Lulu</strong> — printing and shipping. Receives the name and address the book is going to.</li>
          <li><strong class="text-highlighted">Brevo</strong> — the emails we send you: order confirmations, sign-in codes, and notice that a request was sponsored.</li>
          <li><strong class="text-highlighted">Netlify and Neon</strong> — hosting and the database the above is stored in.</li>
        </ul>
        <p>
          The identity providers listed above receive nothing from us. You go to them, they tell us who you are, and the conversation ends there.
        </p>
      </section>

      <section
        id="data-deletion"
        class="scroll-mt-24 space-y-4"
      >
        <h2 class="font-display text-2xl text-highlighted">
          Deleting your data
        </h2>
        <p>
          Two things you can do yourself, without asking us:
        </p>
        <ul class="list-disc space-y-2 pl-6">
          <li>
            <strong class="text-highlighted">Remove an attached account.</strong> On the request form, detach any account you have attached — one of them or all of them. What is removed is destroyed, not merely hidden.
          </li>
          <li>
            <strong class="text-highlighted">Withdraw a request.</strong> An open request on the board can be pulled by the person who posted it, which removes it and the accounts attached to it. A request that has already been sponsored cannot be withdrawn — a copy is already being printed — but you can still ask us to erase it once it has arrived.
          </li>
        </ul>
        <p>
          For anything else — an order, a sign-in, or every trace of you we hold — email <ULink
            class="text-primary"
            to="mailto:hello@doreanpress.org"
          >hello@doreanpress.org</ULink> from the address you used, and we will delete it and confirm when it is done. We aim to do this within 30 days. You may also ask us for a copy of what we hold, or to correct it. Step-by-step instructions live on <ULink
            class="text-primary"
            to="/data-deletion"
          >the data deletion page</ULink>.
        </p>
        <p>
          Two limits worth stating plainly. We keep the record of a completed order for as long as tax and accounting rules require, so a purchase cannot be erased outright until then. And once a book has been printed and posted, Lulu holds its own copy of the delivery address under
          <ULink
            class="text-primary"
            to="https://www.lulu.com/legal/privacy-policy"
            target="_blank"
            rel="noopener"
          >its own privacy policy</ULink>; the same is true of Stripe for a payment.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Children
        </h2>
        <p>
          This site is not directed at children under 13, and we do not knowingly collect their information. If you believe a child has sent us something, write to us and we will remove it.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Changes, and how to reach us
        </h2>
        <p>
          If this policy changes in a way that matters, we will say so here rather than quietly revising it. Questions, requests, or corrections: <ULink
            class="text-primary"
            to="mailto:hello@doreanpress.org"
          >hello@doreanpress.org</ULink>.
        </p>
        <p class="text-base text-muted">
          Last updated {{ updated }}.
        </p>
      </section>
    </div>
  </UContainer>
</template>
