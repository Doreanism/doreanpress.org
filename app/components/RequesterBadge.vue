<script setup lang="ts">
// Who a sponsor would be giving to, drawn from the accounts the reader attached.
//
// This is the one place on the board where somebody decides whether to spend
// money on a stranger, so it is written to be read quickly and to survive being
// read carelessly. Nothing here is a verdict on a person: a sponsor spending
// thirty seconds on the real account learns far more than any badge we could
// draw for them.
//
// There are four states per account, not two, and flattening them would be the
// one unforgivable bug in this component:
//
//   proved   — the reader signed in; the account is theirs.
//   named    — the reader typed it and we found it; it exists, and that is all.
//   told     — the reader typed it and we checked nothing whatever.
//   none     — posted before any of this was required.
//
// Neither of the weak two gets a tick or any word beginning with "verif". Each
// says what it is in plain words, because a sponsor reading quickly will
// otherwise carry away the strongest claim, and it is their money.
//
// The gap between *named* and *told* is easy to wave away as a shade of grey and
// it is not: one means we fetched a page and the account was there, the other
// means somebody typed a name into a box. A sponsor deciding between two cards
// deserves to know which they are looking at.
//
// A request may carry several accounts, and every one of them is drawn, each
// with its own sentence. Showing only the best-checked one would let it vouch
// for the others silently — which is the same flattening as above, wearing a
// different hat. Strongest first, so the card reads down from its best evidence.
import { ULink } from '#components'
import { byStrength, providerLabel, providerIcon, type RequesterIdentity } from '#shared/identity'

const props = defineProps<{ requesters: RequesterIdentity[] }>()

const attached = computed(() => byStrength(props.requesters ?? []))

const label = (r: RequesterIdentity) => providerLabel(r.provider)
const icon = (r: RequesterIdentity) => providerIcon(r.provider)
const isProved = (r: RequesterIdentity) => r.confirmation === 'control'
const isTold = (r: RequesterIdentity) => r.confirmation === 'claimed'

/** Account age is the best signal we have where control was never established. */
function since(r: RequesterIdentity) {
  if (!r.accountCreatedAt) return ''
  const opened = new Date(r.accountCreatedAt)
  return Number.isNaN(opened.getTime()) ? '' : opened.toLocaleDateString('en-US', { year: 'numeric' })
}
</script>

<template>
  <div
    v-if="attached.length === 0"
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
    class="flex flex-col gap-3"
  >
    <div
      v-for="requester in attached"
      :key="`${requester.provider}:${requester.subject}`"
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
              v-if="isProved(requester) && requester.providerVerified"
              :title="`${label(requester)} verifies this account`"
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
              :name="icon(requester)"
              class="size-3 shrink-0"
            />
            <span class="truncate">
              {{ requester.handle ? `@${requester.handle}` : label(requester) }}
              <template v-if="!isProved(requester) && since(requester)"> · since {{ since(requester) }}</template>
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
        One line per account, always present, saying which of the three checks
        happened to *that* one. It sits outside the link so it cannot be mistaken
        for part of the profile, and it is worded for someone who will read
        exactly one of these cards.
      -->
      <p
        v-if="isProved(requester)"
        class="flex items-center gap-1 px-0.5 text-xs text-dimmed"
      >
        <UIcon
          name="i-lucide-shield-check"
          class="size-3 shrink-0 text-primary"
        />
        Signed in with {{ label(requester) }} — the account is theirs.
      </p>
      <p
        v-else-if="isTold(requester)"
        class="flex items-start gap-1 px-0.5 text-xs text-dimmed"
      >
        <UIcon
          name="i-lucide-message-square-quote"
          class="mt-px size-3 shrink-0"
        />
        <span>
          They told us this is their {{ label(requester) }}. We haven't checked that it
          exists or that it's theirs — {{ label(requester) }} gives us no way to. Open it
          and judge for yourself.
        </span>
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
          This {{ label(requester) }} account is real, but we haven't checked the person
          asking is the one who holds it. Open the profile and judge for yourself.
        </span>
      </p>
    </div>
  </div>
</template>
