<script setup lang="ts">
useSeoMeta({
  title: 'Privacy',
  description: 'What Dorean Press collects, what appears publicly, and who receives it.'
})

const updated = 'September 2026'
const providers = 'X, Facebook, LinkedIn, GitHub, GitLab, Twitch, TikTok and Bluesky'
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Privacy"
      description="What we collect, what appears publicly, and who receives it."
    />

    <div class="mx-auto mt-10 max-w-3xl space-y-10 text-lg/8 text-toned">
      <p>
        Dorean Press is a ministry of Lakewood Village Baptist Church, doing business as Silicon Valley Reformed Baptist Church. The church is responsible for the personal information collected through this site. We do not sell it, use it for advertising, or run advertising trackers.
      </p>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          What we collect
        </h2>
        <p>
          <strong class="text-highlighted">When you buy from Amazon.</strong> The purchase happens on Amazon, not on this site. Amazon handles your payment and delivery details. We do not receive them from an ordinary retail purchase.
        </p>
        <p>
          <strong class="text-highlighted">When you ask for a free book.</strong> We collect your name, email address, phone number, shipping address, message, and the books you request. We need these details to review the request, contact you, and send the parcel.
        </p>
        <p>
          <strong class="text-highlighted">When you attach a public account.</strong> You may verify an account with {{ providers }}. We store the provider, account id, display name, and any handle, profile link, avatar, verification mark, or account date the provider makes available. A provider may also give us an email address; your verified sign-in email remains the contact address for requests.
        </p>
        <p>
          <strong class="text-highlighted">When you give.</strong> Zeffy collects your payment information. We receive the details needed to record the gift and match it to your recommendation, such as your name, email address, amount, payment status, receipt, and transaction reference. We do not receive your full card or bank-account number.
        </p>
        <p>
          <strong class="text-highlighted">When you sign in.</strong> We send a single-use sign-in link to your email address and briefly store a hash of its token so we can check it. We save your verified email addresses and linked public profiles to your account. You can add emails by verifying them, choose a primary email for shipping and account notifications, and remove other emails. Your account must keep at least one verified email. Email sign-in is required before linking profiles or requesting books. We use your email address to find your own requests and records.
        </p>
        <p>
          <strong class="text-highlighted">In your browser.</strong> A sealed cookie keeps you signed in and remembers account checks you completed. An unfinished request may be saved in your browser so you do not lose it. Our host may also keep ordinary security logs, including an IP address, browser information, and the page requested.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          What appears publicly
        </h2>
        <p>
          The Give a Book board shows the books requested, the requester's message, and the public accounts they chose to attach. For those accounts, it may show a name, handle, profile link, avatar, verification mark, and approximate account age.
        </p>
        <p>
          It does not show the requester's shipping name, address, phone number, or email address. Donors do not receive those details.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          How we use it
        </h2>
        <ul class="list-disc space-y-2 pl-6">
          <li>To publish and manage the Give a Book board.</li>
          <li>To prevent duplicate or dishonest requests.</li>
          <li>To record gifts and donor recommendations.</li>
          <li>To order books, send updates, and deal with delivery problems.</li>
          <li>To keep the records the church needs for accounting, tax, security, and legal purposes.</li>
        </ul>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Who receives it
        </h2>
        <p>
          We share information only where the ministry needs it:
        </p>
        <ul class="list-disc space-y-2 pl-6">
          <li><strong class="text-highlighted">Lakewood Village Baptist Church</strong> — authorized people who administer the ministry, its gifts, and its records.</li>
          <li><strong class="text-highlighted">Zeffy</strong> — donations, payment processing, and receipts.</li>
          <li><strong class="text-highlighted">Amazon</strong> — the recipient's name, address, phone number, and order details when we send an author copy.</li>
          <li><strong class="text-highlighted">Brevo</strong> — sign-in links and messages about requests and delivery.</li>
          <li><strong class="text-highlighted">Netlify and Neon</strong> — website hosting and database storage.</li>
          <li><strong class="text-highlighted">Account providers</strong> — the information needed to complete a sign-in or verification request. They do not receive your book request or shipping address from us.</li>
        </ul>
        <p>
          We may also disclose information when the law requires it or when reasonably necessary to protect the site, the church, or another person.
        </p>
      </section>

      <section
        id="data-deletion"
        class="scroll-mt-24 space-y-4"
      >
        <h2 class="font-display text-2xl text-highlighted">
          Keeping and deleting information
        </h2>
        <p>
          You can detach a public account after choosing another verified public account as primary, or withdraw an open request yourself. Removing your final public identity requires deleting your reader account. To see, correct, or delete anything else we hold, email <ULink
            class="text-primary"
            to="mailto:info@doreanpress.org"
          >info@doreanpress.org</ULink> from the address you used. We aim to answer within 30 days. Full instructions are on our <ULink
            class="text-primary"
            to="/data-deletion"
          >data deletion page</ULink>.
        </p>
        <p>
          We delete information when we no longer need it, but we may keep donation, order, security, and accounting records where the church has a legal or practical reason to do so. Amazon, Zeffy, and other providers keep their own records under their own policies; deleting our copy does not delete theirs.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Children
        </h2>
        <p>
          This site is not directed to children under 13. If you believe a child has sent us personal information, email us and we will remove it where we can.
        </p>
      </section>

      <section class="space-y-4">
        <h2 class="font-display text-2xl text-highlighted">
          Contact
        </h2>
        <p>
          Questions or privacy requests: <ULink
            class="text-primary"
            to="mailto:info@doreanpress.org"
          >info@doreanpress.org</ULink>.
        </p>
        <p class="text-base text-muted">
          Lakewood Village Baptist Church · EIN 94-2878622 · 709 Lakewood Dr, Sunnyvale, CA 94089 · Last updated {{ updated }}.
        </p>
      </section>
    </div>
  </UContainer>
</template>
