<script setup lang="ts">
// The handful of choices a reader can make about the site itself, for a reader
// with nowhere else to put them.
//
// Everything in here is a preference of this browser and nothing else — it is
// not stored against anybody, because a reader who is not signed in is not
// anybody as far as this site is concerned. Once they are, the account menu
// carries the same control and this button steps aside, so the corner holds one
// place to look rather than two.
</script>

<template>
  <UPopover :content="{ align: 'end' }">
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
