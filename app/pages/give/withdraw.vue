<script setup lang="ts">
import { isSameAccount } from '#shared/identity'
import type { PublicBookRequest } from '~~/server/utils/requests'

useSeoMeta({
  title: 'Remove your request',
  robots: 'noindex'
})

const route = useRoute()
const toast = useToast()
const { loggedIn, user } = useUserSession()

const id = computed(() => String(route.query.id || ''))
const removing = ref(false)

// Look up the request so the reader can confirm it's theirs before removing it.
const { data: request, error } = await useFetch<PublicBookRequest>(
  () => `/api/requests/${id.value}`,
  { immediate: !!id.value }
)

// Mirrors what the server enforces on the DELETE — this only decides which
// panel to show. The account is checked against the public identity on the
// request, which is the same thing the board displays.
const isOwner = computed(() => {
  if (!request.value) return false
  // A posting from before sign-in existed has no account to match, so the
  // unguessable link in the confirmation email remains its only key.
  if (!request.value.requester) return true
  return isSameAccount(user.value?.identity, request.value.requester)
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

      <!-- Someone else's request, or nobody signed in yet -->
      <div
        v-else-if="request && !isOwner"
        class="flex flex-col gap-5 rounded-lg ring ring-default bg-default p-6"
      >
        <template v-if="loggedIn">
          <UIcon
            name="i-lucide-shield-x"
            class="size-10 text-dimmed"
          />
          <p class="text-toned">
            This request belongs to a different account. Only the reader who posted it can
            take it down — sign out and back in with the account you used, if it was you.
          </p>
          <RequesterBadge :requester="request.requester" />
          <UButton
            to="/give"
            label="Back to Give a Book"
            color="neutral"
            variant="subtle"
            class="self-start"
          />
        </template>

        <template v-else>
          <p class="text-toned">
            Sign in with the account you posted this request from and you can take it off
            the board.
          </p>
          <SignInPanel />
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

        <blockquote class="border-l-2 border-primary/40 pl-3 text-sm text-toned italic">
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
