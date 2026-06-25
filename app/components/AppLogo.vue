<script setup lang="ts">
withDefaults(defineProps<{
  markOnly?: boolean
  /** Tailwind height class for the mark, e.g. 'size-8'. */
  size?: string
}>(), {
  markOnly: false,
  size: 'size-8'
})
</script>

<template>
  <span class="inline-flex items-center gap-2.5 align-middle">
    <svg
      :class="size"
      class="shrink-0"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Dorean Press"
    >
      <!-- Rising flame: the word given as light -->
      <path
        d="M24 6c3.6 4.7 5 8.4 5 11.6 0 3.3-2.2 5.7-5 6.4-2.8-.7-5-3.1-5-6.4 0-3.2 1.4-6.9 5-11.6Z"
        fill="var(--ui-primary)"
      />
      <!-- Open book, left page -->
      <path
        d="M24 24.4c-3.7-2.4-8.7-3.2-13.2-2.4-1 .2-1.8 1.1-1.8 2.2v12.2c0 1.3 1.2 2.3 2.5 2.1 3.8-.6 8.1.1 11.3 2.2.7.5 1.5.5 1.2-.9V25.2c0-.3-.1-.6-.4-.8Z"
        fill="currentColor"
        opacity="0.92"
      />
      <!-- Open book, right page -->
      <path
        d="M24 24.4c3.7-2.4 8.7-3.2 13.2-2.4 1 .2 1.8 1.1 1.8 2.2v12.2c0 1.3-1.2 2.3-2.5 2.1-3.8-.6-8.1.1-11.3 2.2-.7.5-1.5.5-1.2-.9V25.2c0-.3.1-.6.4-.8Z"
        fill="currentColor"
      />
    </svg>

    <span
      v-if="!markOnly"
      class="font-display text-xl leading-none tracking-tight"
    >
      <span class="font-semibold text-highlighted">Dorean</span><span class="text-muted"> Press</span>
    </span>
  </span>
</template>
