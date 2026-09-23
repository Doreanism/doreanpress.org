<script setup lang="ts">
import {
  accountKey,
  byDisplayPreference,
  confirmationClaim,
  providerIcon,
  providerLabel,
  type RequesterIdentity
} from '#shared/identity'

// Attaching a public account, away from the request form.
//
// It was only ever possible mid-request, which meant the one thing a giver
// actually reads about a reader could only be set up while filling in an
// address. Here it stands on its own.
//
// Provider identities are durable account links. Authenticating any one of
// them on a later browser recovers this same set.

const { signedIn } = useSignedIn()
const { identities, refresh } = useIdentityProof()

// Coming back from a provider lands here, so pick up what was just attached.
onMounted(() => {
  refresh()
})

const route = useRoute()

/**
 * Detach one account, leaving the others.
 *
 * The page told readers to remove one to make room and gave them nothing to
 * press — the endpoint and the modal's version of this have existed all along.
 *
 * Removing burns the proof server-side rather than only dropping it from the
 * cookie, so an account walked away from is as dead as a spent one. Which is
 * also why there is no undo: getting it back means going to the provider again,
 * and the button says "Remove" rather than anything softer for that reason.
 */
const error = ref('')
const changingPrimary = ref<string | null>(null)

async function makePrimary(identity: RequesterIdentity) {
  changingPrimary.value = accountKey(identity)
  error.value = ''
  try {
    await $fetch('/api/verify/primary', { method: 'PATCH', body: { account: accountKey(identity) } })
    await refresh()
  } catch {
    error.value = 'Could not change your primary profile. Please try again.'
  } finally {
    changingPrimary.value = null
  }
}

const detaching = ref<string | null>(null)

async function detach(identity: RequesterIdentity) {
  const key = accountKey(identity)
  error.value = ''
  detaching.value = key
  try {
    await $fetch('/api/verify/discard', { method: 'POST', body: { account: key } })
  } catch {
    error.value = 'Could not remove this profile. Choose another primary profile before removing this one.'
  } finally {
    await refresh()
    detaching.value = null
  }
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Social profiles"
      description="Manage the public profiles shown with your book requests."
    />

    <div
      v-if="!signedIn?.email"
      class="mt-10 max-w-md"
    >
      <EmailSignIn @authenticated="refresh" />
    </div>
    <div
      v-else
      class="mt-10 flex max-w-2xl flex-col gap-8"
    >
      <p
        v-if="error"
        role="alert"
        class="text-sm text-error"
      >
        {{ error }}
      </p>

      <div class="flex flex-col gap-3">
        <h2 class="font-display text-lg font-semibold text-highlighted">
          Your profiles
        </h2>

        <div
          v-if="identities.length === 0"
          class="rounded-lg bg-elevated/50 p-4 text-sm text-muted"
        >
          Nothing attached yet. Attach a public account below.
        </div>

        <ul
          v-else
          role="list"
          class="flex flex-col gap-2"
        >
          <li
            v-for="identity in byDisplayPreference(identities)"
            :key="`${identity.provider}:${identity.subject}`"
            class="flex flex-wrap items-start gap-3 rounded-lg ring ring-default bg-default p-3"
          >
            <UIcon
              :name="providerIcon(identity.provider)"
              class="mt-0.5 size-5 shrink-0 text-muted"
            />
            <div class="min-w-0 flex-1">
              <p class="font-medium text-highlighted">
                {{ identity.name }}
                <span
                  v-if="identity.handle"
                  class="font-normal text-muted"
                >· @{{ identity.handle }}</span>
              </p>
              <p class="text-sm text-muted">
                {{ confirmationClaim(identity) }}
              </p>
            </div>
            <div class="ms-auto flex shrink-0 items-center gap-2">
              <UBadge
                :label="providerLabel(identity.provider)"
                color="neutral"
                variant="subtle"
                size="sm"
              />
              <UBadge
                v-if="identity.primary"
                label="Primary"
                size="sm"
              />
              <UButton
                v-else
                label="Make primary"
                size="xs"
                variant="ghost"
                :loading="changingPrimary === accountKey(identity)"
                :disabled="detaching !== null || changingPrimary !== null"
                :aria-label="`Make ${identity.name} on ${providerLabel(identity.provider)} primary`"
                @click="makePrimary(identity)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :loading="detaching === accountKey(identity)"
                :disabled="detaching !== null || changingPrimary !== null || identity.primary || identities.length <= 1"
                :aria-label="`Remove ${identity.name} on ${providerLabel(identity.provider)}`"
                :title="identity.primary ? 'Choose another primary profile before removing this one.' : 'Remove'"
                @click="detach(identity)"
              />
            </div>
          </li>
        </ul>
        <p
          v-if="identities.length > 0"
          class="mt-3 text-sm text-muted"
        >
          Your primary profile appears first on your requests. Choose another primary before removing it.
        </p>
      </div>

      <div class="flex flex-col gap-3">
        <h2 class="font-display text-lg font-semibold text-highlighted">
          Attach another
        </h2>

        <!--
          `redirect` brings the reader back here rather than to whatever page
          the component was last used on — the round trip leaves the site, and
          landing somewhere else afterwards reads as having lost your place.
        -->
        <IdentityChallenge
          :redirect="route.fullPath"
          adding
        />
      </div>

      <p class="text-sm text-muted">
        These profiles are saved to your Dorean Press account. Sign in with your
        email address to manage them from any device.
      </p>
    </div>
  </UContainer>
</template>
