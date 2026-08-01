<script setup lang="ts">
import { ULink } from '#components'
import { providerLabel, providerIcon, type RequesterIdentity } from '#shared/identity'

// The account a reader put behind their request.
//
// Deliberately understated: it reports which account was named or proved, and
// nothing about whether the person deserves the books. Where the provider gives
// us a public profile the whole badge becomes a link, because a sponsor spending
// thirty seconds on the real account learns far more than any badge we could
// draw for them.
//
// There are three states here, not two, and flattening them would be the one
// unforgivable bug in this component:
//
//   proved   — the reader signed in; the account is theirs.
//   named    — the reader typed it and we found it; it exists, and that is all.
//   none     — posted before any of this was required.
//
// A *named* account gets no tick and no word beginning with "verif". It says
// what it is in plain words, because a sponsor reading quickly will otherwise
// carry away the stronger claim, and it is their money.
const props = defineProps<{ requester: RequesterIdentity | null }>()

const label = computed(() => (props.requester ? providerLabel(props.requester.provider) : ''))
const icon = computed(() => (props.requester ? providerIcon(props.requester.provider) : ''))
const proved = computed(() => props.requester?.confirmation === 'control')

/** Account age is the best signal we have where control was never established. */
const since = computed(() => {
  const iso = props.requester?.accountCreatedAt
  if (!iso) return ''
  const opened = new Date(iso)
  return Number.isNaN(opened.getTime()) ? '' : opened.toLocaleDateString('en-US', { year: 'numeric' })
})
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
    <span>Posted before verification was required — no account stands behind this one.</span>
  </div>

  <div
    v-else
    class="flex flex-col gap-1.5"
  >
    <component
      :is="requester.profileUrl ? ULink : 'div'"
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
            v-if="proved && requester.providerVerified"
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
          <span class="truncate">
            {{ requester.handle ? `@${requester.handle}` : label }}
            <template v-if="!proved && since"> · since {{ since }}</template>
          </span>
        </p>
      </div>

      <UIcon
        v-if="requester.profileUrl"
        name="i-lucide-external-link"
        class="size-3.5 shrink-0 text-dimmed group-hover:text-primary"
      />
    </component>

    <!--
      One line, always present, saying which of the two checks happened. It sits
      outside the link so it cannot be mistaken for part of the profile, and it
      is worded for someone who will read exactly one of these cards.
    -->
    <p
      v-if="proved"
      class="flex items-center gap-1 px-0.5 text-xs text-dimmed"
    >
      <UIcon
        name="i-lucide-shield-check"
        class="size-3 shrink-0 text-primary"
      />
      Signed in with {{ label }} — the account is theirs.
    </p>
    <p
      v-else
      class="flex items-start gap-1 px-0.5 text-xs text-dimmed"
    >
      <UIcon
        name="i-lucide-search-check"
        class="mt-px size-3 shrink-0"
      />
      <span>
        This {{ label }} account is real, but we haven't checked the person asking is the
        one who holds it. Open the profile and judge for yourself.
      </span>
    </p>
  </div>
</template>
