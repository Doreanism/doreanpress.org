<script setup lang="ts">
// The one menu in the top right, beside the cart.
//
// It holds both what is yours — orders, the accounts standing behind your
// requests, signing in and out — and how this browser draws the site. The gear
// that used to sit beside it is gone, and its contents are a section in here.
//
// The corner was split into two buttons because a merged menu had put a
// preference of this browser in the same list as your orders. What actually
// caused trouble then was not the mixing: it was that Appearance *moved*,
// living in the gear when you were signed out and in the account menu when you
// were signed in, so the corner changed shape depending on who was looking.
// Appearance sits here unconditionally, which is what makes one menu work now
// where it did not before — the list is the same list for everybody, and only
// the last row changes word between Sign in and Sign out.
//
// Your orders and Attach accounts are always offered, signed in or not. Hiding
// them until you sign in would mean the way to find out what this site keeps for
// you is only visible once you already know: both destinations ask for what they
// need when they get there, which is a better answer than a menu that looks
// empty to a stranger.
//
// The icon is a person either way. A reader looking for their account is looking
// for a person, and is likeliest to be looking before they have signed in.

const { signedIn, signOut } = useSignedIn()
const { identities } = useIdentityProof()
const open = ref(false)

async function onSignOut() {
  open.value = false
  await signOut()
  await navigateTo('/')
}
</script>

<template>
  <!--
    `modal` so the page underneath does not scroll while this is open. Without
    it a popover only repositions itself as the page moves away beneath it,
    which on a phone means a flick intended for the menu carries the whole page
    off instead.
  -->
  <UPopover
    v-model:open="open"
    modal
    :content="{ align: 'end' }"
  >
    <!--
      The chip marks the corner as occupied without spelling out by whom — the
      address is a line inside, where it is read rather than glanced at.
    -->
    <UChip
      :show="Boolean(signedIn)"
      size="sm"
      color="primary"
    >
      <!--
        The name says settings as well as account. The gear is gone, so this is
        the only way to reach Light/Dark/System — and a reader who cannot see
        the icon has no other clue that appearance lives behind a person.
      -->
      <UButton
        icon="i-lucide-circle-user-round"
        color="neutral"
        variant="ghost"
        :aria-label="signedIn
          ? `Your account and settings — signed in as ${signedIn.email}`
          : 'Your account and settings'"
        :title="signedIn ? signedIn.email : 'Account and settings'"
      />
    </UChip>

    <template #content>
      <div class="w-60 p-1">
        <p
          v-if="signedIn"
          class="truncate px-2 pt-1.5 pb-1 text-xs font-medium text-muted"
        >
          {{ signedIn.email }}
        </p>

        <UButton
          to="/orders"
          icon="i-lucide-package"
          label="Your orders"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          @click="open = false"
        />

        <!--
          The count is the accounts this browser is holding right now, not a
          total kept against the address — they lapse after twenty minutes.
          Shown because its absence is the useful signal: no number means a
          request would ask you to attach one first.
        -->
        <UButton
          to="/profiles"
          icon="i-lucide-at-sign"
          label="Attach accounts"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          :ui="{ trailingIcon: 'ms-auto' }"
          @click="open = false"
        >
          <template
            v-if="identities.length"
            #trailing
          >
            <UBadge
              :label="String(identities.length)"
              size="sm"
              color="neutral"
              variant="subtle"
              class="ms-auto"
            />
          </template>
        </UButton>

        <USeparator class="my-1" />

        <!--
          The site rather than you, which is why it is fenced off by rules
          rather than folded in with the orders above it. Unconditional: see the
          note at the top for why moving it is the thing that broke this before.
        -->
        <AppAppearance />

        <USeparator class="my-1" />

        <UButton
          v-if="signedIn"
          icon="i-lucide-log-out"
          label="Sign out"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          @click="onSignOut"
        />
        <UButton
          v-else
          to="/orders"
          icon="i-lucide-log-in"
          label="Sign in"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          @click="open = false"
        />
      </div>
    </template>
  </UPopover>
</template>
