<script setup lang="ts">
// Raises an identity challenge: the reader proves they hold a public account and
// comes back here with that proof in hand for whatever they were doing.
//
// Not a login. There is no account to create, no password, and nothing is
// remembered afterwards — the copy below is careful not to imply otherwise.
//
// The provider list comes from the server rather than being hard-coded, so a
// deployment that has only configured one of them never shows a button that
// dead-ends on the provider's error page.

interface ProviderOption {
  id: string
  label: string
  icon: string
  devOnly: boolean
}

const props = defineProps<{
  /** Where to land once the challenge passes. Defaults to the page we're on. */
  redirect?: string
}>()

const route = useRoute()
const { data: providers } = await useFetch<ProviderOption[]>('/api/verify/providers', {
  default: () => []
})

const mock = computed(() => providers.value.find(p => p.devOnly))
const mockName = ref('Test Reader')

function challengeUrl(provider: ProviderOption) {
  const params = new URLSearchParams({ redirect: props.redirect || route.fullPath })
  // The mock provider keys the account off the name, so two different names are
  // two different people to test the one-request-per-account rule with.
  if (provider.devOnly) params.set('name', mockName.value.trim() || 'Test Reader')
  return `/verify/${provider.id}?${params}`
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-start gap-3 rounded-lg bg-elevated/50 p-4">
      <UIcon
        name="i-lucide-shield-check"
        class="mt-0.5 size-5 shrink-0 text-primary"
      />
      <div class="space-y-1 text-sm">
        <p class="font-medium text-highlighted">
          Show that a public account stands behind this
        </p>
        <p class="text-muted">
          A sponsor is a stranger paying for your books out of their own pocket. A public
          account beside your request lets them see who they're giving to.
        </p>
        <p class="text-muted">
          Your name, photo and profile link appear on the board. Your address, email and
          phone number never do.
        </p>
      </div>
    </div>

    <UFormField
      v-if="mock"
      label="Test account name"
      hint="dev only"
      description="No provider credentials are configured, so the check is mocked. Change the name to act as a different person."
    >
      <UInput
        v-model="mockName"
        class="w-full"
      />
    </UFormField>

    <div class="flex flex-col gap-2">
      <UButton
        v-for="provider in providers"
        :key="provider.id"
        :to="challengeUrl(provider)"
        external
        :icon="provider.icon"
        :label="provider.devOnly ? 'Use a test account' : `Verify with ${provider.label}`"
        :color="provider.devOnly ? 'warning' : 'neutral'"
        variant="subtle"
        size="lg"
        block
      />
    </div>

    <p
      v-if="providers.length === 0"
      class="rounded-md bg-elevated/50 p-3 text-sm text-muted"
    >
      No way to verify an account is configured on this site yet, so requests can't be
      posted. Please
      <ULink
        to="/about"
        class="text-primary"
      >get in touch</ULink> and we'll sort it out.
    </p>

    <p class="text-xs text-dimmed">
      We read your public profile once and keep nothing beyond what you see above. You
      are not creating an account and there is no password. We never post anything, and
      we don't ask for your contacts or your friends.
    </p>
  </div>
</template>
