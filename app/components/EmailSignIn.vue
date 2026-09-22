<script setup lang="ts">
const emit = defineEmits<{ authenticated: [] }>()
const props = defineProps<{ redirect?: string }>()
const route = useRoute()
const { pending, requestLink, refresh } = useSignedIn()
const email = ref('')
const sent = ref(false)
const error = ref('')
const notice = ref('')

async function send() {
  if (pending.value) return
  error.value = ''
  try {
    await requestLink(email.value, props.redirect || route.fullPath)
    sent.value = true
    notice.value = 'Check your inbox for a sign-in link. Open it within ten minutes to sign in. Use the newest email if you request another link.'
  } catch {
    error.value = 'Could not send a link. Please try again shortly.'
  }
}
// The email may open in another tab. Resume the original request when the
// reader returns, without clearing its draft or signing into a different inbox.
async function resume() {
  if (!sent.value) return
  const account = await refresh().catch(() => null)
  if (account?.email === email.value.trim().toLowerCase()) emit('authenticated')
}
onMounted(() => window.addEventListener('focus', resume))
onBeforeUnmount(() => window.removeEventListener('focus', resume))
</script>

<template>
  <form
    class="space-y-4"
    @submit.prevent="send()"
  >
    <p class="text-sm text-muted">
      We’ll email you a link to sign in or create an account. No password to remember.
    </p>
    <UFormField
      label="Email address"
      required
    >
      <UInput
        v-model="email"
        type="email"
        autocomplete="email"
        placeholder="you@example.com"
        size="lg"
        required
        maxlength="320"
        :disabled="sent || pending"
        class="w-full"
      />
    </UFormField>
    <p
      v-if="pending || notice"
      role="status"
      class="text-sm text-muted"
    >
      {{ pending ? 'Sending your sign-in link…' : notice }}
    </p>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
    <div class="flex flex-wrap gap-2">
      <UButton
        type="submit"
        size="lg"
        :label="pending ? 'Sending…' : sent ? 'Resend sign-in link' : 'Email me a sign-in link'"
        :loading="pending"
      />
      <UButton
        v-if="sent"
        label="Use another email"
        variant="ghost"
        color="neutral"
        :disabled="pending"
        @click="sent = false; error = ''; notice = ''"
      />
    </div>
  </form>
</template>
