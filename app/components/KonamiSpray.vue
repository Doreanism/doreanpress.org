<script setup lang="ts">
// Easter egg: enter the Konami code to arm it, and from then on holding the
// mouse down spills books out of the pointer — a small hop up, then a steady
// fall out through the bottom of the window. Keep the button down and drag, and
// they keep coming, laying a trail behind the cursor. Purely decorative —
// clicks still do whatever they were going to do.
const BOOKS_PER_PRESS = 120
// While the button is held, more every tick, strung along the path the pointer
// took since the last one so a fast drag pours rather than dots.
const BOOKS_PER_TICK = 9
const TICK_MS = 30
// Falling speed in pixels per millisecond, the same the whole way down.
const FALL_SPEED = 0.6
// Every book leaves on its own heading at its own speed, in pixels per
// millisecond — that spread of launches is what makes it a spray rather than a
// column that drifts apart later.
const LAUNCH_MIN = 0.5
const LAUNCH_MAX = 1.7
// How long the throw keeps pushing before the fall has it: sideways for the
// whole of that, upwards only until the book runs out of climb.
const SIDEWAYS_MS = 320
const UPWARDS_MS = 380
const MAX_CLIMB_MS = 420

interface Book {
  id: number
  x: number
  y: number
  delay: number
  flight: number
  climb: string
  tx: string
  rise: string
  fall: string
  rot: string
  size: string
}

const armed = ref(false)
const books = ref<Book[]>([])
let nextId = 0
const timers = new Set<ReturnType<typeof setTimeout>>()

interface Point { x: number, y: number }

let calm = false
let held: Point | null = null
// Where the last book came out, so the next lot can be strung from there.
let lastSpill: Point | null = null
let ticker: ReturnType<typeof setInterval> | null = null

// One book per point given, so a batch can be piled at the cursor or laid along
// the stretch it just travelled.
function spill(points: Point[]) {
  const batch: Book[] = points.map(({ x, y }) => {
    // Far enough below the bottom edge that the book is well clear of it.
    const drop = window.innerHeight - y + 160

    // Thrown off in any direction bar straight down, at its own speed.
    const heading = (5 + Math.random() * 170) * (Math.PI / 180)
    const launch = LAUNCH_MIN + Math.random() * (LAUNCH_MAX - LAUNCH_MIN)
    const sideways = Math.cos(heading) * launch
    const upwards = Math.sin(heading) * launch

    // The climb runs out sooner for a book thrown gently than for one flung
    // hard, so the two never look like they were released together.
    const climb = Math.min(MAX_CLIMB_MS, upwards * UPWARDS_MS)
    const rise = (upwards * climb) / 2 // slowing to a stop, so half the distance

    // Constant speed downwards, so the time on screen follows the distance to
    // cover rather than the other way round.
    const speed = FALL_SPEED * (0.85 + Math.random() * 0.3) * (calm ? 0.6 : 1)

    return {
      id: nextId++,
      x,
      y,
      // Barely staggered — enough to break up the edge of the cloud, not enough
      // to feel like a wait after the click.
      delay: Math.random() * 20,
      // The fall covers the climb as well as the drop, so wherever a book was
      // thrown it still ends up the same distance below the bottom edge.
      flight: (drop + rise) / speed,
      climb: `${climb}ms`,
      tx: `${sideways * SIDEWAYS_MS}px`,
      rise: `${-rise}px`,
      fall: `${drop + rise}px`,
      rot: `${(Math.random() - 0.5) * 540}deg`, // a lazy tumble either way
      // Five sizes rather than any size at all: the glyph is rasterised once
      // per size, and with hundreds on screen that bill is worth keeping small.
      size: `${1 + Math.floor(Math.random() * 5) * 0.2}rem`
    }
  })

  // No ceiling on how many are in the air: each one leaves of its own accord
  // once it's off the bottom, so a long drag trails books the whole way.
  books.value = [...books.value, ...batch]

  // Each batch clears out once its slowest book is below the bottom edge.
  const ids = new Set(batch.map(b => b.id))
  const lifetime = Math.max(...batch.map(b => b.delay + b.flight)) + 200
  const timer = setTimeout(() => {
    books.value = books.value.filter(b => !ids.has(b.id))
    timers.delete(timer)
  }, lifetime)
  timers.add(timer)
}

// The stretch from the last spill to where the pointer is now, cut into as many
// points as there are books to place along it.
function trail(to: Point, count: number): Point[] {
  const from = lastSpill ?? to
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 1) / count
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }
  })
}

function onPointerDown(e: PointerEvent) {
  if (!armed.value) return
  held = { x: e.clientX, y: e.clientY }
  lastSpill = held
  spill(Array.from({ length: BOOKS_PER_PRESS }, () => held as Point))

  ticker ??= setInterval(() => {
    if (!held) return
    spill(trail(held, BOOKS_PER_TICK))
    lastSpill = held
  }, TICK_MS)
}

function onPointerMove(e: PointerEvent) {
  if (held) held = { x: e.clientX, y: e.clientY }
}

function stop() {
  held = null
  lastSpill = null
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

useKonamiCode(() => {
  armed.value = true
  // Confirm the unlock with a spill from the middle of the screen.
  const middle = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  spill(Array.from({ length: BOOKS_PER_PRESS }, () => middle))
})

onMounted(() => {
  calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', stop)
  window.addEventListener('pointercancel', stop)
  // A drag that ends outside the window still has to let go.
  window.addEventListener('blur', stop)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', stop)
  window.removeEventListener('pointercancel', stop)
  window.removeEventListener('blur', stop)
  stop()
  for (const t of timers) clearTimeout(t)
  timers.clear()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="books.length"
      class="konami-stage"
      aria-hidden="true"
    >
      <!-- Two elements per book, carrying four separately timed movements
           between them: `transform` throws it sideways while `translate` drops
           it, and inside, `translate` lifts it while `rotate` tumbles it. Those
           are distinct properties, so each can keep its own curve and duration
           without a wrapper of its own — which keeps the node count down when
           there are hundreds in the air. -->
      <!-- v-memo with nothing to watch: a book never changes once it is thrown,
           so this skips re-patching every one of them each time another lot
           joins the list. -->
      <span
        v-for="b in books"
        :key="b.id"
        v-memo="[]"
        class="konami-shot"
        :style="{
          'left': `${b.x}px`,
          'top': `${b.y}px`,
          '--delay': `${b.delay}ms`,
          '--flight': `${b.flight}ms`,
          '--climb': b.climb,
          '--tx': b.tx,
          '--rise': b.rise,
          '--fall': b.fall,
          '--rot': b.rot,
          '--size': b.size
        }"
      ><span class="konami-book">📚</span></span>
    </div>
  </Teleport>
</template>

<style scoped>
.konami-stage {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  pointer-events: none;
}

/* Both elements run off the same per-book --delay and --flight, set inline.
   No will-change: at these numbers, a promoted layer per book costs far more
   than it saves, and a running transform animation is composited anyway. */
.konami-shot,
.konami-book {
  animation-delay: var(--delay, 0ms);
  animation-duration: var(--flight, 2s);
  animation-fill-mode: forwards;
  animation-timing-function: linear;
}

/* Anchored on the pointer, wherever it was when this book left. The throw goes
   on `transform` — away fast, then lost to the air, so a book is seen leaving
   the cursor rather than sliding apart from its neighbours later. The fall goes
   on `translate`, one steady rate the whole way. */
.konami-shot {
  position: absolute;
  animation-name: konami-throw, konami-fall;
  animation-timing-function: cubic-bezier(0.12, 0.62, 0.3, 1), linear;
}

/* Climbing until it runs out of throw, then left where it is — the fall above
   is what takes the book back down. */
.konami-book {
  display: block;
  font-size: var(--size, 1.4rem);
  line-height: 1;
  opacity: 0;
  animation-name: konami-climb, konami-tumble;
  animation-duration: var(--climb, 300ms), var(--flight, 2s);
  animation-timing-function: cubic-bezier(0.15, 0.6, 0.4, 1), linear;
}

/* Carries the centring as well, so the book sits on the cursor at the off. */
@keyframes konami-throw {
  from { transform: translate(-50%, -50%); }
  to { transform: translate(calc(-50% + var(--tx, 0px)), -50%); }
}

@keyframes konami-climb {
  from { translate: 0 0; }
  to { translate: 0 var(--rise, -60px); }
}

/* One steady rate the whole way down and out through the bottom edge — no
   fading out, the window is what takes them off stage. */
@keyframes konami-fall {
  from { translate: 0 0; }
  to { translate: 0 var(--fall, 800px); }
}

/* Full strength from the first frame: the base rule keeps a book hidden through
   its delay, and it is simply there the moment its animation starts. */
@keyframes konami-tumble {
  0% { opacity: 1; rotate: 0deg; }
  100% { opacity: 1; rotate: var(--rot, 180deg); }
}
</style>
