<script setup lang="ts">
// The light/dark/system choice.
//
// One section of the one corner menu, and unconditionally so. It used to live
// in the gear when you were signed out and move into the account menu when you
// were signed in, which is the arrangement that made a merged corner unworkable
// — a control you have to go looking for in a different place depending on your
// own state. Kept a component of its own because it is a distinct subject
// inside that menu, not because it has anywhere else to go.
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
