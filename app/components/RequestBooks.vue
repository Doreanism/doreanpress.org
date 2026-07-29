<script setup lang="ts">
import { findBook, type RequestItem } from '#shared/catalog'

// A request is a whole order, so it may hold several titles. One title reads as
// a plain row; several are dealt like a hand of cards — each cover tucked over
// the one before it — instead of a tall stack of rows.
//
// A long order is summarised rather than drawn in full: past three titles the
// fan ends in an ellipsis and the list collapses, so a request for a dozen
// books takes about as much room on the board as a request for two. Everything
// beyond that is one click away, which matters because the hidden lines are
// still selectable. The ellipsis is deliberately not cover-shaped — a blank
// card in the fan reads as a book we failed to load.
//
// Pass `selectable` with a v-model to let a sponsor pick out part of the order:
// the titles get checkboxes (and a copy count where more than one was asked
// for), and covers they haven't picked fade back in the fan.
const props = withDefaults(defineProps<{
  items: RequestItem[]
  selectable?: boolean
  /** The picked lines. Only meaningful with `selectable`. */
  modelValue?: RequestItem[]
}>(), {
  selectable: false,
  modelValue: () => []
})

const emit = defineEmits<{ 'update:modelValue': [RequestItem[]] }>()

const lines = computed(() =>
  props.items
    .map(item => ({ item, book: findBook(item.slug) }))
    .filter((l): l is { item: RequestItem, book: NonNullable<typeof l.book> } => Boolean(l.book)))

function picked(slug: string): RequestItem | undefined {
  return props.modelValue.find(i => i.slug === slug)
}

/** Unpicked lines only fade once selecting is actually on offer. */
function isPicked(slug: string) {
  return !props.selectable || Boolean(picked(slug))
}

function copiesFor(slug: string) {
  return picked(slug)?.quantity ?? 0
}

/** Rewrite the selection, keeping it in the order the books were requested. */
function apply(next: Map<string, number>) {
  emit('update:modelValue', lines.value
    .map(line => ({ slug: line.item.slug, quantity: next.get(line.item.slug) ?? 0 }))
    .filter(i => i.quantity > 0))
}

function current() {
  return new Map(props.modelValue.map(i => [i.slug, i.quantity]))
}

function toggle(line: { item: RequestItem }, on: boolean) {
  const next = current()
  if (on) next.set(line.item.slug, line.item.quantity)
  else next.delete(line.item.slug)
  apply(next)
}

function setCopies(line: { item: RequestItem }, copies: number) {
  const clamped = Math.max(1, Math.min(line.item.quantity, Math.floor(copies) || 1))
  const next = current()
  next.set(line.item.slug, clamped)
  apply(next)
}

/** Titles drawn in full before the order is summarised instead. */
const MAX_SHOWN = 3

const expanded = ref(false)

/** How many titles the ellipsis and the toggle are standing in for. */
const hiddenCount = computed(() => Math.max(0, lines.value.length - MAX_SHOWN))

// The fan stays capped even when the list is open: fifteen overlapping covers
// would run past the edge of the card whatever we did with the tilt.
const fanned = computed(() => lines.value.slice(0, MAX_SHOWN))
const listed = computed(() => (expanded.value ? lines.value : lines.value.slice(0, MAX_SHOWN)))

/** Fan the covers out from the middle, the way a hand of cards sits. */
function tilt(index: number) {
  const middle = (fanned.value.length - 1) / 2
  return `${((index - middle) * 4).toFixed(2)}deg`
}
</script>

<template>
  <div
    v-if="lines.length === 1 && lines[0]"
    class="flex gap-4"
  >
    <NuxtLink :to="`/catalog/${lines[0].item.slug}`">
      <img
        :src="lines[0].book.cover"
        :alt="lines[0].book.title"
        class="h-24 w-auto rounded ring ring-default transition"
        :class="isPicked(lines[0].item.slug) ? '' : 'opacity-40 saturate-0'"
      >
    </NuxtLink>
    <div class="min-w-0">
      <NuxtLink
        :to="`/catalog/${lines[0].item.slug}`"
        class="font-display font-semibold text-highlighted hover:text-primary"
      >
        {{ lines[0].book.title }}
      </NuxtLink>
      <p class="text-sm text-muted">
        {{ lines[0].book.author }}
      </p>
      <p
        v-if="lines[0].item.quantity > 1"
        class="text-sm text-toned"
      >
        {{ lines[0].item.quantity }} copies
      </p>
      <div
        v-if="selectable && lines[0].item.quantity > 1"
        class="mt-2 flex items-center gap-2"
      >
        <span class="text-sm text-muted">Sponsor</span>
        <UInputNumber
          :model-value="copiesFor(lines[0].item.slug) || 1"
          :min="1"
          :max="lines[0].item.quantity"
          size="xs"
          class="w-20"
          :aria-label="`Copies of ${lines[0].book.title} to sponsor`"
          @update:model-value="(v: number) => setCopies(lines[0]!, v)"
        />
        <span class="text-sm text-muted">of {{ lines[0].item.quantity }}</span>
      </div>
    </div>
  </div>

  <div
    v-else-if="lines.length > 1"
    class="flex flex-col gap-3"
  >
    <div class="flex px-2 pt-2">
      <NuxtLink
        v-for="(line, i) in fanned"
        :key="line.item.slug"
        :to="`/catalog/${line.item.slug}`"
        :style="{ rotate: tilt(i), marginLeft: i === 0 ? undefined : '-2rem' }"
        class="relative origin-bottom transition duration-200 hover:z-10 hover:-translate-y-2"
      >
        <img
          :src="line.book.cover"
          :alt="line.book.title"
          class="h-24 w-auto rounded shadow-md ring ring-default transition"
          :class="isPicked(line.item.slug) ? '' : 'opacity-40 saturate-0'"
        >
      </NuxtLink>

      <button
        v-if="hiddenCount"
        type="button"
        class="relative self-center px-3 font-display text-xl leading-none text-muted transition hover:text-primary"
        :aria-expanded="expanded"
        :aria-label="expanded ? 'Show fewer books' : `Show ${hiddenCount} more ${hiddenCount === 1 ? 'book' : 'books'}`"
        :title="expanded ? 'Show fewer books' : `${hiddenCount} more`"
        @click="expanded = !expanded"
      >
        …
      </button>
    </div>

    <ul
      role="list"
      class="flex flex-col gap-1 text-sm"
    >
      <li
        v-for="line in listed"
        :key="line.item.slug"
        class="flex min-w-0 items-start gap-2"
      >
        <UCheckbox
          v-if="selectable"
          :model-value="Boolean(picked(line.item.slug))"
          class="mt-0.5"
          :aria-label="`Sponsor ${line.book.title}`"
          @update:model-value="(v: boolean | 'indeterminate') => toggle(line, v === true)"
        />
        <div class="min-w-0">
          <NuxtLink
            :to="`/catalog/${line.item.slug}`"
            class="font-display font-semibold text-highlighted hover:text-primary"
          >
            {{ line.book.title }}
          </NuxtLink>
          <span class="text-muted"> · {{ line.book.author }}</span>
          <span
            v-if="line.item.quantity > 1"
            class="text-toned"
          > · {{ line.item.quantity }} copies</span>

          <div
            v-if="selectable && line.item.quantity > 1 && picked(line.item.slug)"
            class="mt-1 flex items-center gap-2"
          >
            <span class="text-muted">Sponsor</span>
            <UInputNumber
              :model-value="copiesFor(line.item.slug)"
              :min="1"
              :max="line.item.quantity"
              size="xs"
              class="w-20"
              :aria-label="`Copies of ${line.book.title} to sponsor`"
              @update:model-value="(v: number) => setCopies(line, v)"
            />
            <span class="text-muted">of {{ line.item.quantity }}</span>
          </div>
        </div>
      </li>
    </ul>

    <UButton
      v-if="hiddenCount"
      :label="expanded ? 'Show fewer' : `Show all ${lines.length} books`"
      :icon="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
      color="neutral"
      variant="link"
      size="xs"
      class="-mt-2 self-start px-0"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    />
  </div>
</template>
