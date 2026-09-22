<script setup lang="ts">
const { signedIn } = useSignedIn()
const route = useRoute()
async function authenticated() {
  const target = route.query.redirect
  // Restrict post-login navigation to local paths, including encoded slashes.
  if (typeof target === 'string' && /^\/(?![/\\])/.test(target) && !/%(?:2f|5c)/i.test(target)) {
    await navigateTo(target)
  }
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <div
      v-if="!signedIn?.email"
      class="mx-auto grid max-w-4xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-16"
    >
      <section
        aria-labelledby="sign-in-heading"
        class="rounded-xl border border-default bg-elevated/50 p-6 sm:p-8"
      >
        <h1
          id="sign-in-heading"
          class="mb-3 font-display text-2xl font-semibold text-highlighted"
        >
          Welcome to Dorean Press
        </h1>
        <EmailSignIn
          :redirect="typeof route.query.redirect === 'string' ? route.query.redirect : undefined"
          @authenticated="authenticated"
        />
        <p class="mt-6 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <UIcon
            name="i-lucide-lock-keyhole"
            class="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          Your email stays private. It isn’t shown on your book requests or public profile.
        </p>
      </section>
      <section
        aria-label="Account features"
        class="lg:py-3"
      >
        <ul class="space-y-6">
          <li
            v-for="feature in [
              { icon: 'i-lucide-book-open', title: 'Track your orders', description: 'Check the status of your book orders and see delivery updates.' },
              { icon: 'i-lucide-gift', title: 'Give a book', description: 'Help another reader receive a book and keep track of the requests you’ve supported.' },
              { icon: 'i-lucide-at-sign', title: 'Manage emails and profiles', description: 'Verify additional emails, choose where updates go, and manage your social profiles.' }
            ]"
            :key="feature.title"
            class="flex gap-4"
          >
            <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UIcon
                :name="feature.icon"
                class="size-5"
                aria-hidden="true"
              />
            </span>
            <div>
              <h2 class="font-medium text-highlighted">
                {{ feature.title }}
              </h2>
              <p class="mt-1 text-sm leading-relaxed text-muted">
                {{ feature.description }}
              </p>
            </div>
          </li>
        </ul>
      </section>
    </div>
    <div
      v-else
      class="mx-auto max-w-lg space-y-6"
    >
      <div>
        <p class="text-sm text-muted">
          Signed in with verified email
        </p>
        <p class="break-words font-medium">
          {{ signedIn.email }}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <UButton
          to="/give"
          label="Give a book"
          variant="subtle"
          icon="i-lucide-gift"
        />
        <UButton
          to="/orders"
          label="Your orders"
          icon="i-lucide-package"
        />
        <UButton
          to="/profiles"
          label="Emails & profiles"
          variant="subtle"
          icon="i-lucide-at-sign"
        />
      </div>
      <p class="text-sm text-muted">
        Your email stays private. Attach a public profile so sponsors can see who they’re giving to when you request books.
      </p>
    </div>
  </UContainer>
</template>
