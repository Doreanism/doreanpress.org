<script setup lang="ts">
// One place for the handful of choices a reader can make about the site itself.
// There is no account here, so everything in it is a preference of this browser
// and nothing else.
const colorMode = useColorMode()

const appearances = [
  { value: 'light', label: 'Light', icon: 'i-lucide-sun' },
  { value: 'dark', label: 'Dark', icon: 'i-lucide-moon' },
  { value: 'system', label: 'System', icon: 'i-lucide-monitor' }
]
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
        <p class="px-2 pt-1.5 pb-1 text-xs font-medium text-muted">
          Appearance
        </p>

        <!--
          The current choice is only known on the client: the server has no way
          to tell which one this browser holds, and rendering a guess would show
          the tick beside the wrong row for a moment after load.
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
  </UPopover>
</template>
