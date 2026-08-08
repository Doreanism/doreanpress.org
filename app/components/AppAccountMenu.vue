<script setup lang="ts">
// The account, in the top right beside the cart.
//
// Signed out there is nothing to choose between — one destination, which asks
// for an address when it gets there — so the icon is a plain link rather than a
// menu with a single item in it. Signed in there is somewhere to go, something
// to attach, a preference to set and a way to leave, so it opens.
//
// The icon is the same either way. A reader looking for their account is
// looking for a person, and is most likely to be looking precisely when they
// are not signed in yet.

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
  <UButton
    v-if="!signedIn"
    to="/orders"
    icon="i-lucide-circle-user-round"
    color="neutral"
    variant="ghost"
    aria-label="Sign in to see your orders"
    title="Sign in"
  />

  <UPopover
    v-else
    v-model:open="open"
    :content="{ align: 'end' }"
  >
    <!--
      The chip marks the corner as occupied without spelling out by whom — the
      address is a line inside, where it is read rather than glanced at.
    -->
    <UChip
      show
      size="sm"
      color="primary"
    >
      <UButton
        icon="i-lucide-circle-user-round"
        color="neutral"
        variant="ghost"
        :aria-label="`Your account — signed in as ${signedIn.email}`"
        :title="signedIn.email"
      />
    </UChip>

    <template #content>
      <div class="w-60 p-1">
        <p class="truncate px-2 pt-1.5 pb-1 text-xs font-medium text-muted">
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
          The count is the attached accounts this browser is holding right now,
          not a total kept against the address — they lapse after twenty
          minutes. Shown because its absence is the useful signal: no number
          means a request would ask you to attach one first.
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

        <AppAppearance />

        <USeparator class="my-1" />

        <UButton
          icon="i-lucide-log-out"
          label="Sign out"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          @click="onSignOut"
        />
      </div>
    </template>
  </UPopover>
</template>
