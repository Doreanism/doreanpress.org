<script setup lang="ts">
import { providerLabel } from '#shared/identity'
import type { DropdownMenuItem } from '@nuxt/ui'

// Shown in the header only once a reader has signed in. There's no "sign in"
// counterpart: nothing on the site needs an account except asking for a free
// book, so the prompt belongs in that flow rather than in the chrome.
const { loggedIn, user, clear } = useUserSession()
const toast = useToast()

const identity = computed(() => user.value?.identity)

async function signOut() {
  await clear()
  toast.add({
    title: 'Signed out',
    icon: 'i-lucide-log-out',
    color: 'neutral'
  })
}

const items = computed<DropdownMenuItem[][]>(() => [
  [{
    type: 'label',
    label: identity.value?.name ?? '',
    avatar: { src: identity.value?.avatarUrl, alt: identity.value?.name }
  }],
  [{
    label: `Signed in with ${identity.value ? providerLabel(identity.value.provider) : ''}`,
    icon: identity.value?.profileUrl ? 'i-lucide-external-link' : 'i-lucide-check',
    to: identity.value?.profileUrl,
    target: identity.value?.profileUrl ? '_blank' : undefined,
    disabled: !identity.value?.profileUrl
  }],
  [{
    label: 'Sign out',
    icon: 'i-lucide-log-out',
    onSelect: signOut
  }]
])
</script>

<template>
  <UDropdownMenu
    v-if="loggedIn && identity"
    :items="items"
    :content="{ align: 'end' }"
  >
    <UButton
      color="neutral"
      variant="ghost"
      :aria-label="`Signed in as ${identity.name}`"
    >
      <UAvatar
        :src="identity.avatarUrl"
        :alt="identity.name"
        size="2xs"
      />
    </UButton>
  </UDropdownMenu>
</template>
