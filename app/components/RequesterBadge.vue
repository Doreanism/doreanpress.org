<script setup lang="ts">
import { ULink } from '#components'
import { providerIcon, providerLabel, type RequesterIdentity } from '#shared/identity'

// The account a reader put behind their request.
//
// Deliberately understated: it reports which account signed in, and nothing
// about whether the person deserves the books. Where the provider gives us a
// public profile the whole badge becomes a link, because a sponsor spending
// thirty seconds on the real account learns far more than any badge we could
// draw for them.
const props = defineProps<{ requester: RequesterIdentity | null }>()

const label = computed(() => (props.requester ? providerLabel(props.requester.provider) : ''))
const icon = computed(() => (props.requester ? providerIcon(props.requester.provider) : ''))
</script>

<template>
  <div
    v-if="!requester"
    class="flex items-start gap-2 rounded-md bg-elevated/50 px-2.5 py-2 text-xs text-dimmed"
  >
    <UIcon
      name="i-lucide-user-round-x"
      class="mt-px size-4 shrink-0"
    />
    <span>Posted before sign-in was required — no account stands behind this one.</span>
  </div>

  <component
    :is="requester.profileUrl ? ULink : 'div'"
    v-else
    v-bind="requester.profileUrl
      ? { to: requester.profileUrl, external: true, target: '_blank' }
      : {}"
    class="group flex items-center gap-2.5 rounded-md px-2.5 py-2 ring ring-default"
    :class="requester.profileUrl ? 'hover:bg-elevated/50' : ''"
  >
    <UAvatar
      :src="requester.avatarUrl"
      :alt="requester.name"
      size="sm"
    />

    <div class="min-w-0 flex-1">
      <p class="flex items-center gap-1 text-sm font-medium text-highlighted">
        <span class="truncate">{{ requester.name }}</span>
        <span
          v-if="requester.providerVerified"
          :title="`${label} verifies this account`"
          class="flex"
        >
          <UIcon
            name="i-lucide-badge-check"
            class="size-3.5 shrink-0 text-primary"
          />
        </span>
      </p>
      <p class="flex items-center gap-1 text-xs text-dimmed">
        <UIcon
          :name="icon"
          class="size-3 shrink-0"
        />
        <span class="truncate">{{ requester.handle ? `@${requester.handle}` : `Signed in with ${label}` }}</span>
      </p>
    </div>

    <UIcon
      v-if="requester.profileUrl"
      name="i-lucide-external-link"
      class="size-3.5 shrink-0 text-dimmed group-hover:text-primary"
    />
  </component>
</template>
