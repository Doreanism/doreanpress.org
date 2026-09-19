<script setup lang="ts">
import doreanLogo from '~/assets/logos/doreanlogo.svg?url'
import doreanPress from '~/assets/logos/doreanpress.svg?url'

const props = withDefaults(defineProps<{
  markOnly?: boolean
  /** Tailwind classes sizing the complete lockup or standalone mark. */
  size?: string
}>(), {
  markOnly: false,
  size: 'h-8 w-auto'
})

const artwork = computed(() => props.markOnly ? doreanLogo : doreanPress)
</script>

<template>
  <NuxtLink
    to="/"
    class="inline-flex shrink-0"
    aria-label="Dorean Press"
  >
    <img
      :src="artwork"
      :class="size"
      alt="Dorean Press"
      class="shrink-0 dark:invert"
    >
  </NuxtLink>
</template>
