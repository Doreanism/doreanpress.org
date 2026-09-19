<script setup lang="ts">
/* eslint-disable vue/no-v-html -- the rendered strings are trusted local SVG assets */
import doreanLogo from '~/assets/logos/doreanlogo.svg?raw'
import doreanPress from '~/assets/logos/doreanpress.svg?raw'

const props = withDefaults(defineProps<{
  markOnly?: boolean
  /** Tailwind classes sizing the complete lockup or standalone mark. */
  size?: string
}>(), {
  markOnly: false,
  size: 'h-8 w-auto'
})

const artwork = computed(() => props.markOnly ? doreanLogo : doreanPress)
const proportions = computed(() => props.markOnly ? '113.47788 / 153.92664' : '833.401 / 260')
</script>

<template>
  <NuxtLink
    to="/"
    :class="size"
    class="inline-block shrink-0 text-highlighted"
    aria-label="Dorean Press"
    :style="{ aspectRatio: proportions }"
  >
    <!-- The markup is a trusted, repository-owned SVG whose paths use currentColor. -->
    <span
      class="block h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      aria-hidden="true"
      v-html="artwork"
    />
  </NuxtLink>
</template>
