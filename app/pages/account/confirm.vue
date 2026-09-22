<script setup lang="ts">
const { confirmLink } = useSignedIn()
const token = ref('')
const ready = ref(false)
const signingIn = ref(false)
const error = ref('')
useHead({ meta: [{ name: 'referrer', content: 'no-referrer' }, { name: 'robots', content: 'noindex, nofollow' }] })
onMounted(async () => {
  token.value = new URLSearchParams(window.location.hash.slice(1)).get('token') || ''
  // Remove the credential from browser history as soon as it is read.
  window.history.replaceState(window.history.state, '', window.location.pathname)
  ready.value = true
  if (token.value) await confirm()
})
async function confirm() {
  error.value = ''
  signingIn.value = true
  try {
    const result = await confirmLink(token.value)
    token.value = ''
    await navigateTo(result.redirect)
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } }).data?.statusMessage || 'Could not sign in. Please try again.'
  } finally {
    signingIn.value = false
  }
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <section class="mx-auto max-w-md space-y-5 rounded-xl border border-default bg-elevated/50 p-6 sm:p-8">
      <h1 class="font-display text-2xl font-semibold text-highlighted">
        Sign in to Dorean Press
      </h1>
      <p
        v-if="!error && (!ready || signingIn)"
        role="status"
        class="flex items-center gap-2 text-sm text-muted"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-5 shrink-0 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        Signing you in…
      </p>
      <p
        v-else-if="!error"
        class="text-sm text-muted"
      >
        This page needs a sign-in link from your email. Please request a new link.
      </p>
      <p
        v-if="error"
        role="alert"
        class="text-sm text-error"
      >
        {{ error }}
      </p>
      <UButton
        v-if="error || (ready && !token && !signingIn)"
        to="/account"
        label="Request a new link"
        variant="ghost"
      />
    </section>
  </UContainer>
</template>
