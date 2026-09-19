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
const proportions = computed(() => props.markOnly ? '113.47788 / 153.92664' : '833.401 / 260')
</script>

<template>
  <NuxtLink
    to="/"
    :class="size"
    class="inline-block shrink-0 bg-current text-highlighted"
    aria-label="Dorean Press"
    :style="{
      aspectRatio: proportions,
      maskImage: `url(${artwork})`,
      maskPosition: 'center',
      maskRepeat: 'no-repeat',
      maskSize: 'contain'
    }"
  />
</template>
