<script setup lang="ts">
// A reader's message as it appears on the board, clamped to three lines so one
// long plea doesn't stretch its card past every other card in the row.
//
// Line breaks are kept: a reader who comes back to add a book has their new
// words held under the old ones in the same message (see `foldOrders`), and run
// together they would read as one confused sentence.
//
// The toggle only appears when there is genuinely more to read, and that has to
// be measured rather than guessed: whether a message overflows three lines
// depends on the card width, the font and where the words happen to break, none
// of which a character count would capture.
//
// The withdraw page shows the message unclamped on purpose — there is one
// request on that page, and the reader is confirming their own words.
defineProps<{ message: string }>()

const expanded = ref(false)
const overflows = ref(false)
const quote = useTemplateRef<HTMLElement>('quote')

function measure() {
  const node = quote.value
  // Nothing to learn while expanded — the clamp is off, so the element is
  // exactly as tall as its content and the answer would always be "fits".
  // Keeping the last measurement is what leaves "Show less" on screen.
  if (!node || expanded.value) return
  overflows.value = node.scrollHeight > node.clientHeight + 1
}

onMounted(() => {
  measure()
  // A narrower card fits fewer words per line, and a late-loading webfont
  // changes the metrics underneath us.
  const observer = new ResizeObserver(measure)
  observer.observe(quote.value!)
  document.fonts?.ready.then(measure)
  onBeforeUnmount(() => observer.disconnect())
})
</script>

<template>
  <div class="flex-1">
    <!--
      The message is whatever the reader typed, so it may be one unpunctuated
      run with nowhere obvious to break. `wrap-anywhere` also holds the grid
      track down, which `break-words` would not.
    -->
    <blockquote
      ref="quote"
      class="border-l-2 border-primary/40 pl-3 text-sm text-toned italic whitespace-pre-line hyphens-auto wrap-anywhere"
      :class="{ 'line-clamp-3': !expanded }"
    >
      “{{ message }}”
    </blockquote>

    <UButton
      v-if="overflows"
      :label="expanded ? 'Show less' : 'Read more'"
      color="neutral"
      variant="link"
      size="xs"
      class="mt-1 px-0"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    />
  </div>
</template>
