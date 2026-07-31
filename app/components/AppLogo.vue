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
      <!--
        The flame carries a fixed warm gradient rather than `--ui-primary`, so
        it stays orange whichever theme is picked. The candle is white in both
        colour modes; in light mode it takes a dark outline so it still reads
        against the white header.
      -->
      <defs>
        <linearGradient
          id="dp-flame"
          x1="24"
          y1="6"
          x2="24"
          y2="24"
          gradientUnits="userSpaceOnUse"
        >
          <stop
            offset="0"
            stop-color="#E1372B"
          />
          <stop
            offset="1"
            stop-color="#F5A524"
          />
        </linearGradient>
      </defs>

      <!-- Rising flame: the word given as light -->
      <path
        d="M24 6c3.6 4.7 5 8.4 5 11.6 0 3.3-2.2 5.7-5 6.4-2.8-.7-5-3.1-5-6.4 0-3.2 1.4-6.9 5-11.6Z"
        fill="url(#dp-flame)"
      />
      <!-- Open book, left page (a touch translucent, so the spine reads) -->
      <path
        d="M24 24.4c-3.7-2.4-8.7-3.2-13.2-2.4-1 .2-1.8 1.1-1.8 2.2v12.2c0 1.3 1.2 2.3 2.5 2.1 3.8-.6 8.1.1 11.3 2.2.7.5 1.5.5 1.2-.9V25.2c0-.3-.1-.6-.4-.8Z"
        fill="#FFFFFF"
        opacity="0.92"
      />
      <!-- Open book, right page -->
      <path
        d="M24 24.4c3.7-2.4 8.7-3.2 13.2-2.4 1 .2 1.8 1.1 1.8 2.2v12.2c0 1.3-1.2 2.3-2.5 2.1-3.8-.6-8.1.1-11.3 2.2-.7.5-1.5.5-1.2-.9V25.2c0-.3.1-.6.4-.8Z"
        fill="#FFFFFF"
      />
      <!--
        Outline only. Two open subpaths trace the outer edge of each page and
        meet at the head and foot of the spine without drawing it, so the book
        gets a silhouette and no line down the middle.
      -->
      <path
        d="M24 24.4c-3.7-2.4-8.7-3.2-13.2-2.4-1 .2-1.8 1.1-1.8 2.2v12.2c0 1.3 1.2 2.3 2.5 2.1 3.8-.6 8.1.1 11.3 2.2.7.5 1.5.5 1.2-.9M24 24.4c3.7-2.4 8.7-3.2 13.2-2.4 1 .2 1.8 1.1 1.8 2.2v12.2c0 1.3-1.2 2.3-2.5 2.1-3.8-.6-8.1.1-11.3 2.2-.7.5-1.5.5-1.2-.9"
        fill="none"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="stroke-neutral-900 dark:stroke-0"
      />
      <!-- Spine: barely there, just enough to part the two pages -->
      <path
        d="M24 26.4v12.6"
        fill="none"
        stroke-width="1.2"
        stroke-linecap="round"
        opacity="0.2"
        class="stroke-neutral-900 dark:stroke-0"
      />
    </svg>

    <span
      v-if="!markOnly"
      class="font-display text-xl leading-none tracking-tight text-highlighted"
    >
      Dorean Press
    </span>
  </span>
</template>
