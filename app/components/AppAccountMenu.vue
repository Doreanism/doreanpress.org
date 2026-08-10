<script setup lang="ts">
// The account, in the top right between the settings gear and the cart.
//
// Everything here is about *you* — what you are owed, what you have given, the
// accounts standing behind your requests. Choices about the site itself live in
// the gear, so neither menu changes shape depending on who is looking.
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
  <UPopover
    v-model:open="open"
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
      <UButton
        icon="i-lucide-circle-user-round"
        color="neutral"
        variant="ghost"
        :aria-label="signedIn ? `Your account — signed in as ${signedIn.email}` : 'Your account'"
        :title="signedIn ? signedIn.email : 'Account'"
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
