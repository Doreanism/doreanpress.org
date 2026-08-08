<script setup lang="ts">
// The light/dark/system choice, on its own so it can sit in either menu.
//
// It lives in the settings popover for a reader who is not signed in, and moves
// into the account menu for one who is — the same control, not two, so the tick
// can never disagree with itself.
const colorMode = useColorMode()

const appearances = [
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' },
  { value: 'system', label: 'System', icon: 'i-lucide-monitor' }
]
</script>

<template>
  <div>
    <p class="px-2 pt-1.5 pb-1 text-xs font-medium text-muted">
      Appearance
    </p>

    <!--
      The current choice is only known on the client: the server has no way to
      tell which one this browser holds, and rendering a guess would show the
      tick beside the wrong row for a moment after load.
    -->
    <ClientOnly>
      <UButton
        v-for="appearance in appearances"
        :key="appearance.value"
        :icon="appearance.icon"
        :label="appearance.label"
        :trailing-icon="colorMode.preference === appearance.value ? 'i-lucide-check' : undefined"
        color="neutral"
        variant="ghost"
        block
        class="justify-start"
        :ui="{ trailingIcon: 'ms-auto' }"
        :aria-pressed="colorMode.preference === appearance.value"
        @click="colorMode.preference = appearance.value"
      />

      <template #fallback>
        <UButton
          v-for="appearance in appearances"
          :key="appearance.value"
          :icon="appearance.icon"
          :label="appearance.label"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          disabled
        />
      </template>
    </ClientOnly>
  </div>
</template>
