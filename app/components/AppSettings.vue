<script setup lang="ts">
// Choices about the site itself, as opposed to choices about you.
//
// Always here, signed in or not. Appearance briefly lived in the account menu
// and moved depending on who you were, which meant the same control had two
// homes and a rule about which one was in force. It has one home now, and the
// split is by subject rather than by state: this button is the site, the person
// beside it is you.
//
// Everything in here is a preference of this browser and nothing else. It is not
// stored against an account, and signing out does not disturb it.
</script>

<template>
  <!--
    `modal` so the page underneath does not scroll while this is open. Without
    it a popover only repositions itself as the page moves away beneath it,
    which on a phone means a flick intended for the menu carries the whole page
    off instead.
  -->
  <UPopover
    modal
    :content="{ align: 'end' }"
  >
    <UButton
      icon="i-lucide-settings"
      color="neutral"
      variant="ghost"
      aria-label="Settings"
    />

    <template #content>
      <div class="w-48 p-1">
        <AppAppearance />
      </div>
    </template>
  </UPopover>
</template>
