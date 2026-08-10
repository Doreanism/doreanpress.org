<script setup lang="ts">
// The account, in the top right beside the cart — and the only menu up there.
//
// There was a settings gear next to this holding the appearance choice, which
// meant two buttons for one corner and a rule to remember: appearance was in the
// gear until you signed in, then it moved. One menu, always, is less to explain
// and less to look for. The cart keeps its own button because it is a
// destination rather than a menu.
//
// So this opens whether or not anybody is signed in. Signed out it holds the way
// in and the appearance choice; signed in it holds the address, somewhere to go,
// something to attach, appearance, and a way out.
//
// The icon is a person in both states. A reader looking for their account is
// looking for a person, and is most likely to be looking precisely when they are
// not signed in yet.

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
        :aria-label="signedIn ? `Your account — signed in as ${signedIn.email}` : 'Account and settings'"
        :title="signedIn ? signedIn.email : 'Account'"
      />
    </UChip>

    <template #content>
      <div class="w-60 p-1">
        <template v-if="signedIn">
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
        </template>

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

        <USeparator class="my-1" />

        <AppAppearance />

        <template v-if="signedIn">
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
        </template>
      </div>
    </template>
  </UPopover>
</template>
