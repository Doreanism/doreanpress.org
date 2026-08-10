<script setup lang="ts">
import {
  accountKey,
  byStrength,
  confirmationClaim,
  providerIcon,
  providerLabel,
  MAX_ATTACHED,
  type RequesterIdentity
} from '#shared/identity'

// Attaching a public account, away from the request form.
//
// It was only ever possible mid-request, which meant the one thing a giver
// actually reads about a reader could only be set up while filling in an
// address. Here it stands on its own.
//
// What it cannot pretend: an attached account is not stored against anybody. A
// proof is evidence of a moment at a provider, it lasts twenty minutes, and it
// is spent on the request it was raised for. So this page shows what this
// browser is holding *now* rather than a list on file, and says so — the
// alternative is a page that looks like a saved setting and quietly empties
// itself while the reader is making tea.

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
const detaching = ref<string | null>(null)

async function detach(identity: RequesterIdentity) {
  const key = accountKey(identity)
  detaching.value = key
  try {
    await $fetch('/api/verify/discard', { method: 'POST', body: { account: key } })
  } catch {
    // Even if the call fails, re-reading below tells us where we actually stand.
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
      title="Public accounts"
      description="Asking for a free book means showing a public account, so a giver — a stranger paying out of their own pocket — can see who they are giving to. Attach one here, or when you post a request."
    />

    <div class="mt-10 flex max-w-2xl flex-col gap-8">
      <div class="flex flex-col gap-3">
        <h2 class="font-display text-lg font-semibold text-highlighted">
          Attached now
        </h2>

        <div
          v-if="identities.length === 0"
          class="rounded-lg bg-elevated/50 p-4 text-sm text-muted"
        >
          Nothing attached at the moment. Attaching one below holds it for about
          twenty minutes — long enough to post a request with it.
        </div>

        <ul
          v-else
          role="list"
          class="flex flex-col gap-2"
        >
          <li
            v-for="identity in byStrength(identities)"
            :key="`${identity.provider}:${identity.subject}`"
            class="flex items-start gap-3 rounded-lg ring ring-default bg-default p-3"
          >
            <UIcon
              :name="providerIcon(identity.provider)"
              class="mt-0.5 size-5 shrink-0 text-muted"
            />
            <div class="min-w-0">
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
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                :loading="detaching === accountKey(identity)"
                :disabled="detaching !== null"
                :aria-label="`Remove ${identity.name} on ${providerLabel(identity.provider)}`"
                title="Remove"
                @click="detach(identity)"
              />
            </div>
          </li>
        </ul>
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
          :limit="MAX_ATTACHED"
          :redirect="route.fullPath"
          adding
        />
      </div>

      <p class="text-sm text-muted">
        These are held by this browser for about twenty minutes and are not saved
        to your account — they are evidence that you were just at the provider,
        which is the thing that makes them worth anything to a giver. Signing in
        by email is separate, and does not attach anything.
      </p>
    </div>
  </UContainer>
</template>
