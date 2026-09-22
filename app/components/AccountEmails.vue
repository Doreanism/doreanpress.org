<script setup lang="ts">
const { refresh: refreshAccount } = useSignedIn()
const { data, refresh } = await useFetch('/api/account/emails', { key: 'account-emails' })
const email = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')
async function send() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await $fetch('/api/account/emails', { method: 'POST', body: { email: email.value } })
    notice.value = `Check ${email.value} for a verification link. Open it in this browser within ten minutes to add the address.`
    email.value = ''
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } }).data?.statusMessage || 'Could not send a verification link.'
  } finally {
    busy.value = false
  }
}
async function change(address: string, method: 'PATCH' | 'DELETE') {
  busy.value = true
  error.value = ''
  try {
    data.value = await $fetch('/api/account/emails', { method, body: { email: address } })
    await refreshAccount()
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } }).data?.statusMessage || 'Could not update your email addresses.'
  } finally {
    busy.value = false
  }
}
function onFocus() {
  refresh()
}
onMounted(() => window.addEventListener('focus', onFocus))
onBeforeUnmount(() => window.removeEventListener('focus', onFocus))
</script>

<template>
  <section class="space-y-4">
    <h2 class="font-display text-lg font-semibold text-highlighted">
      Email addresses
    </h2>
    <p class="text-sm text-muted">
      Sign in with any verified email. Shipping updates and other account notifications go to your primary email. Your email addresses stay private.
    </p>
    <ul class="space-y-2">
      <li
        v-for="address in data?.emails"
        :key="address.email"
        class="flex flex-wrap items-center gap-3 rounded-lg border border-default p-3"
      >
        <span class="min-w-0 flex-1 break-words">{{ address.email }}</span>
        <UBadge
          v-if="address.primary"
          label="Primary"
          variant="subtle"
        />
        <UButton
          v-else
          label="Make primary"
          size="xs"
          variant="ghost"
          :disabled="busy"
          :aria-label="`Make ${address.email} primary`"
          @click="change(address.email, 'PATCH')"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          :disabled="busy || address.primary || (data?.emails.length ?? 0) <= 1"
          :aria-label="`Remove ${address.email}`"
          :title="address.primary ? 'Choose another primary email before removing this one.' : 'Remove email'"
          @click="change(address.email, 'DELETE')"
        />
      </li>
    </ul>
    <p class="text-sm text-muted">
      Keep at least one verified email. To remove your primary email, first make another address primary.
    </p>
    <form
      class="flex flex-col items-start gap-3 sm:flex-row sm:items-end"
      @submit.prevent="send"
    >
      <UFormField
        label="Add an email address"
        required
        class="w-full sm:flex-1"
      >
        <UInput
          v-model="email"
          type="email"
          autocomplete="email"
          required
          maxlength="320"
          placeholder="you@example.com"
          class="w-full"
          :disabled="busy"
        />
      </UFormField>
      <UButton
        type="submit"
        label="Send verification link"
        :loading="busy"
      />
    </form>
    <p
      v-if="notice"
      role="status"
      class="text-sm text-muted"
    >
      {{ notice }}
    </p>
    <p
      v-if="error"
      role="alert"
      class="text-sm text-error"
    >
      {{ error }}
    </p>
  </section>
</template>
