<script setup lang="ts">
import { isSameAccount } from '#shared/identity'
import type { PublicBookRequest } from '~~/server/utils/requests'

useSeoMeta({
  title: 'Remove your request',
  robots: 'noindex'
})

const route = useRoute()
const toast = useToast()
const { identity, verified } = useIdentityProof()

const id = computed(() => String(route.query.id || ''))
const removing = ref(false)

// Look up the request so the reader can confirm it's theirs before removing it.
const { data: request, error } = await useFetch<PublicBookRequest>(
  () => `/api/requests/${id.value}`,
  { immediate: !!id.value }
)

// Mirrors what the server enforces on the DELETE — this only decides which
// panel to show. The proof in hand is compared against the public identity on
// the request, which is the same thing the board displays.
const isOwner = computed(() => {
  if (!request.value) return false
  // A posting from before the challenge existed has no account to match, so the
  // unguessable link in the confirmation email remains its only key.
  if (!request.value.requester) return true
  return isSameAccount(identity.value, request.value.requester)
})

async function withdraw() {
  if (!id.value) return
  removing.value = true
  try {
    await $fetch(`/api/requests/${id.value}`, { method: 'DELETE' })
    await navigateTo('/give')
    toast.add({
      title: 'Book request deleted',
      description: 'It’s off the Give a Book board.',
      icon: 'i-lucide-check',
      color: 'primary'
    })
  } catch (err) {
    const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'Could not remove your request. Please try again.'
    toast.add({ title: 'Something went wrong', description: message, icon: 'i-lucide-triangle-alert', color: 'error' })
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Remove your request"
    />

    <div class="mt-10 max-w-xl">
      <!-- No id, or request not found / already sponsored -->
      <div
        v-if="!id || error"
        class="flex flex-col items-start gap-4 rounded-lg ring ring-default bg-default p-6"
      >
        <UIcon
          name="i-lucide-search-x"
          class="size-10 text-dimmed"
        />
        <p class="text-toned">
          We couldn’t find an open request to remove. It may have already been
          sponsored, or already withdrawn. If a sponsor has sent your copy, it’s
          on its way and can’t be cancelled.
        </p>
        <UButton
          to="/give"
          label="Back to Give a Book"
          color="neutral"
          variant="subtle"
        />
      </div>

      <!-- Posted from another account, or no proof in hand yet -->
      <div
        v-else-if="request && !isOwner"
        class="flex flex-col gap-5 rounded-lg ring ring-default bg-default p-6"
      >
        <template v-if="verified">
          <UIcon
            name="i-lucide-shield-x"
            class="size-10 text-dimmed"
          />
          <p class="text-toned">
            You verified a different account to the one this request was posted from. Only
            the reader who posted it can take it down — verify again with the right
            account, if it was you.
          </p>
          <RequesterBadge :requester="request.requester" />
          <IdentityChallenge />
        </template>

        <template v-else>
          <p class="text-toned">
            Verify the account you posted this request from and you can take it off the
            board.
          </p>
          <IdentityChallenge />
        </template>
      </div>

      <!-- Confirm removal -->
      <div
        v-else-if="request"
        class="flex flex-col gap-5 rounded-lg ring ring-default bg-default p-6"
      >
        <p class="text-toned">
          Remove this request from the <em>Give a Book</em> board? Once removed,
          sponsors will no longer see it. You can submit a new request any time.
        </p>

        <RequestBooks :items="request.items" />

        <blockquote class="border-l-2 border-primary/40 pl-3 text-sm text-toned italic hyphens-auto wrap-anywhere">
          “{{ request.message }}”
        </blockquote>

        <div class="flex flex-wrap gap-3">
          <UButton
            label="Remove my request"
            icon="i-lucide-trash-2"
            color="error"
            :loading="removing"
            @click="withdraw"
          />
          <UButton
            to="/give"
            label="Keep it on the board"
            color="neutral"
            variant="subtle"
          />
        </div>
      </div>
    </div>
  </UContainer>
</template>
