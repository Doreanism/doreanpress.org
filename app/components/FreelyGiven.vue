<script setup lang="ts">
// Easter egg: type `freely` anywhere and the page gives its books away. They
// lift off the bottom edge, drift up and out through the top, and the line the
// footer already carries surfaces for a moment in the middle of the window.
//
// Deliberately a release rather than a spray. The press exists to argue that
// what was freely received is freely given, so the books leave and nothing
// comes back — the window is what takes them, and none of it is clickable.
const BOOKS = 64
const CALM_BOOKS = 18

// Pixels per millisecond upward. Slow on purpose: this is letting go of
// something, not firing it.
const RISE_MIN = 0.20
const RISE_MAX = 0.36
// Released over this long, so it reads as a stream leaving rather than a wall
// of books moving in step.
const RELEASE_MS = 1600
// How far a book wanders sideways over the whole climb.
const SWAY_MIN = 20
const SWAY_MAX = 70
// Clear of the top edge before it is dropped from the list.
const OVERSHOOT = 180
// How long the verse is up for. Kept in step with the `given-verse-in`
// animation below by hand — a mismatch shows as the line vanishing mid-fade.
const VERSE_MS = 3400

interface Book {
  id: number
  x: number
  y: number
  delay: number
  flight: number
  rise: string
  sway: string
  rot: string
  size: string
}

const books = ref<Book[]>([])
// Bumped on every release so the verse re-mounts and its animation restarts —
// typing the word again while one is still running should read as a second
// giving, not as nothing happening.
const verseKey = ref(0)
const showVerse = ref(false)

let nextId = 0
let calm = false
const timers = new Set<ReturnType<typeof setTimeout>>()
// Held separately from the batch timers so a second release can call off the
// first one's hide — otherwise typing the word twice cuts the verse short
// partway through the run it just restarted.
let verseTimer: ReturnType<typeof setTimeout> | null = null

function later(fn: () => void, ms: number) {
  const t = setTimeout(() => {
    timers.delete(t)
    fn()
  }, ms)
  timers.add(t)
}

function give() {
  const count = calm ? CALM_BOOKS : BOOKS
  const start = window.innerHeight + 24
  const distance = window.innerHeight + OVERSHOOT

  const batch: Book[] = Array.from({ length: count }, () => {
    const speed = (RISE_MIN + Math.random() * (RISE_MAX - RISE_MIN)) * (calm ? 0.6 : 1)
    const sway = (SWAY_MIN + Math.random() * (SWAY_MAX - SWAY_MIN)) * (Math.random() < 0.5 ? -1 : 1)

    return {
      id: nextId++,
      // Across the full width, so the page empties evenly rather than from one
      // spot the reader happens to be looking at.
      x: Math.random() * window.innerWidth,
      y: start,
      delay: Math.random() * RELEASE_MS,
      // Constant speed, so time on screen follows the distance to cover and a
      // tall window does not make the whole thing feel slower.
      flight: distance / speed,
      rise: `${-distance}px`,
      sway: `${sway}px`,
      // A lazy turn either way. Nothing near a full rotation: a book that
      // cartwheels looks thrown, and this one is being handed over.
      rot: `${(Math.random() - 0.5) * 90}deg`,
      // Five sizes rather than any size at all: the glyph is rasterised once
      // per size, and there is no reason to pay for sixty of them.
      size: `${1 + Math.floor(Math.random() * 5) * 0.2}rem`
    }
  })

  books.value = [...books.value, ...batch]

  const ids = new Set(batch.map(b => b.id))
  const lifetime = Math.max(...batch.map(b => b.delay + b.flight)) + 200
  later(() => {
    books.value = books.value.filter(b => !ids.has(b.id))
  }, lifetime)

  verseKey.value++
  showVerse.value = true
  if (verseTimer) clearTimeout(verseTimer)
  verseTimer = setTimeout(() => {
    verseTimer = null
    showVerse.value = false
  }, VERSE_MS)
}

useSecretWord('freely', give)

onMounted(() => {
  calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

// Nothing is bound to the window here — no pointer handlers left armed for the
// rest of the session, which is the other half of why this replaced what was
// here before. Only the pending timers need letting go of.
onUnmounted(() => {
  for (const t of timers) clearTimeout(t)
  timers.clear()
  if (verseTimer) clearTimeout(verseTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="books.length || showVerse"
      class="given-stage"
      aria-hidden="true"
    >
      <!-- One element per book carrying four separately timed movements:
           `translate` lifts it, `transform` sways it, `rotate` turns it and
           `opacity` lets it go. Those are four distinct properties feeding one
           matrix, so none of them needs a wrapper of its own. -->
      <!-- v-memo with nothing to watch: a book never changes once released, so
           this skips re-patching every one of them when a second lot joins. -->
      <span
        v-for="b in books"
        :key="b.id"
        v-memo="[]"
        class="given-book"
        :style="{
          'left': `${b.x}px`,
          'top': `${b.y}px`,
          '--delay': `${b.delay}ms`,
          '--flight': `${b.flight}ms`,
          '--rise': b.rise,
          '--sway': b.sway,
          '--rot': b.rot,
          '--size': b.size
        }"
      >📖</span>

      <p
        v-if="showVerse"
        :key="verseKey"
        class="given-verse text-muted"
      >
        “Freely you have received; freely give.” — Matthew 10:8
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
.given-stage {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  pointer-events: none;
}

/* No will-change: a promoted layer per book costs more than it saves at these
   numbers, and a running transform animation is composited regardless. */
.given-book {
  position: absolute;
  display: block;
  font-size: var(--size, 1.4rem);
  line-height: 1;
  opacity: 0;
  animation-name: given-rise, given-sway, given-turn, given-release;
  animation-duration: var(--flight, 4s);
  animation-delay: var(--delay, 0ms);
  animation-fill-mode: forwards;
  animation-timing-function: linear, ease-in-out, linear, linear;
}

@keyframes given-rise {
  from { translate: 0 0; }
  to { translate: 0 var(--rise, -900px); }
}

/* Carries the centring too, so a book sits on its own column at the off. */
@keyframes given-sway {
  from { transform: translate(-50%, -50%); }
  to { transform: translate(calc(-50% + var(--sway, 0px)), -50%); }
}

@keyframes given-turn {
  from { rotate: 0deg; }
  to { rotate: var(--rot, 20deg); }
}

/* Full strength for most of the climb — the base rule holds a book hidden
   through its delay — then gone before it reaches the top edge, so the page
   lets go of it rather than the window snatching it away. */
@keyframes given-release {
  0% { opacity: 1; }
  70% { opacity: 1; }
  100% { opacity: 0; }
}

.given-verse {
  position: absolute;
  top: 22%;
  left: 50%;
  width: min(90vw, 34rem);
  margin: 0;
  text-align: center;
  text-wrap: balance;
  font-size: 1rem;
  font-style: italic;
  transform: translateX(-50%);
  animation: given-verse-in 3400ms ease-in-out forwards;
}

@keyframes given-verse-in {
  0% { opacity: 0; translate: 0 8px; }
  15% { opacity: 1; translate: 0 0; }
  72% { opacity: 1; translate: 0 0; }
  100% { opacity: 0; translate: 0 -6px; }
}

/* The books already thin out to a slower drift; the verse is the part worth
   holding still, so it simply appears rather than sliding in. */
@media (prefers-reduced-motion: reduce) {
  .given-verse {
    animation-name: given-verse-fade;
  }

  @keyframes given-verse-fade {
    0% { opacity: 0; }
    15% { opacity: 1; }
    72% { opacity: 1; }
    100% { opacity: 0; }
  }
}
</style>
