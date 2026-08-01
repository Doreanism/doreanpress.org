<script setup lang="ts">
// Puts a public account behind a request, by whichever of two routes the reader
// has one for.
//
// Not a login. There is no account to create, no password, and nothing is
// remembered afterwards — the copy below is careful not to imply otherwise.
//
// The two routes are not equivalent and the layout says so. Signing in proves
// the account is the reader's. Naming one only proves it is there, and that
// weaker promise is written out in full next to the field rather than left for
// someone to infer from a green tick — a sponsor is about to spend money on the
// difference.
//
// The provider lists come from the server rather than being hard-coded, so a
// deployment that has only configured one of them never shows a button that
// dead-ends on the provider's error page.

import { providerLabel, type IdentityProvider, type RequesterIdentity } from '#shared/identity'

interface ChallengeOption {
  id: IdentityProvider
  label: string
  icon: string
}

interface LookupOption extends ChallengeOption {
  accountHint: string
  accountExample: string
}

const props = defineProps<{
  /** Where to land once the challenge passes. Defaults to the page we're on. */
  redirect?: string
}>()

const emit = defineEmits<{ confirmed: [RequesterIdentity] }>()

const route = useRoute()
const { data: providers } = await useFetch<{ challenge: ChallengeOption[], lookup: LookupOption[] }>(
  '/api/verify/providers',
  { default: () => ({ challenge: [], lookup: [] }) }
)

const challengeProviders = computed(() => providers.value.challenge)
const lookupProviders = computed(() => providers.value.lookup)

function challengeUrl(provider: ChallengeOption) {
  const params = new URLSearchParams({ redirect: props.redirect || route.fullPath })
  return `/verify/${provider.id}?${params}`
}

// ── naming an account ──
const chosen = ref<IdentityProvider | null>(null)
const account = ref('')
const looking = ref(false)
const error = ref('')
const found = ref<RequesterIdentity | null>(null)

const chosenMeta = computed(() => lookupProviders.value.find(p => p.id === chosen.value) ?? null)

// A challenge comes back through a full page load, so the session is read fresh
// on the way in. A lookup never leaves the page: the proof is sealed into the
// cookie by the endpoint, and nothing on the client knows until it is asked
// again. Without this the account is confirmed and the form stays locked.
const { refresh: refreshProof } = useIdentityProof()

// Switching provider invalidates whatever was typed for the previous one — a
// GitHub username is not a Mastodon address — so the field starts clean.
watch(chosen, () => {
  account.value = ''
  error.value = ''
  found.value = null
})

async function confirm() {
  if (!chosen.value || !account.value.trim() || looking.value) return
  looking.value = true
  error.value = ''
  found.value = null
  try {
    const { identity } = await $fetch<{ identity: RequesterIdentity }>('/api/verify/lookup', {
      method: 'POST',
      body: { provider: chosen.value, account: account.value }
    })
    found.value = identity
    await refreshProof()
    emit('confirmed', identity)
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'We could not check that account. Please try again.'
  } finally {
    looking.value = false
  }
}

function accountAge(iso?: string) {
  if (!iso) return ''
  const opened = new Date(iso)
  if (Number.isNaN(opened.getTime())) return ''
  return opened.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
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

    <!--
      Signing in comes first, and is described as the stronger thing it is. A
      reader with an account on any of these has no reason to use the weaker
      route, and the ordering is what tells them so.
    -->
    <div
      v-if="challengeProviders.length"
      class="flex flex-col gap-2"
    >
      <p class="text-sm font-medium text-highlighted">
        Sign in to prove the account is yours
      </p>
      <UButton
        v-for="provider in challengeProviders"
        :key="provider.id"
        :to="challengeUrl(provider)"
        external
        :icon="provider.icon"
        :label="`Verify with ${provider.label}`"
        color="neutral"
        variant="subtle"
        size="lg"
        block
      />
    </div>

    <div
      v-if="challengeProviders.length && lookupProviders.length"
      class="flex items-center gap-3 text-xs text-dimmed"
    >
      <span class="h-px flex-1 bg-accented" />
      or
      <span class="h-px flex-1 bg-accented" />
    </div>

    <div
      v-if="lookupProviders.length"
      class="flex flex-col gap-3"
    >
      <div>
        <p class="text-sm font-medium text-highlighted">
          Or name an account and we'll look it up
        </p>
        <p class="mt-1 text-sm text-muted">
          We'll fetch the profile to check it's really there. This shows a sponsor a real
          account — but it doesn't prove the account is yours, and your request will say
          so.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="provider in lookupProviders"
          :key="provider.id"
          :icon="provider.icon"
          :label="provider.label"
          :color="chosen === provider.id ? 'primary' : 'neutral'"
          :variant="chosen === provider.id ? 'solid' : 'subtle'"
          size="sm"
          @click="chosen = provider.id"
        />
      </div>

      <UFormField
        v-if="chosenMeta"
        :label="`Your ${chosenMeta.label} ${chosenMeta.accountHint}`"
        :error="error || undefined"
      >
        <div class="flex gap-2">
          <UInput
            v-model="account"
            class="flex-1"
            :placeholder="chosenMeta.accountExample"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            :disabled="looking"
            @keydown.enter.prevent="confirm()"
          />
          <UButton
            icon="i-lucide-user-search"
            label="Confirm"
            color="neutral"
            :loading="looking"
            :disabled="!account.trim()"
            @click="confirm()"
          />
        </div>
        <template #help>
          Paste your profile link if that's easier.
        </template>
      </UFormField>

      <!--
        The found account is drawn plainly, and the sentence under it is the
        whole point of this panel: it states what was and was not checked, in
        the same breath as the tick, so the two are never read apart.
      -->
      <div
        v-if="found"
        class="flex items-start gap-3 rounded-lg bg-elevated/50 p-3 ring ring-default"
      >
        <UAvatar
          :src="found.avatarUrl"
          :alt="found.name"
          size="md"
        />
        <div class="min-w-0 flex-1 space-y-1">
          <p class="flex items-center gap-1.5 text-sm font-medium text-highlighted">
            <UIcon
              name="i-lucide-circle-check"
              class="size-4 shrink-0 text-primary"
            />
            <span class="truncate">{{ found.name }}</span>
          </p>
          <p class="truncate text-xs text-dimmed">
            {{ found.handle ? `@${found.handle}` : providerLabel(found.provider) }}
            <span v-if="accountAge(found.accountCreatedAt)">
              · on {{ providerLabel(found.provider) }} since {{ accountAge(found.accountCreatedAt) }}
            </span>
          </p>
          <p class="text-xs text-muted">
            This account exists and we read its public profile. We haven't checked that
            you're the person who holds it — your request will show it as named, not
            proved.
          </p>
        </div>
      </div>
    </div>

    <p
      v-if="challengeProviders.length === 0 && lookupProviders.length === 0"
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
