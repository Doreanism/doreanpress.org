<script setup lang="ts">
// Easter egg: enter the Konami code and a little guy sprints across the
// screen tossing books over his shoulder. Purely decorative.
//
// He runs three lengths in a Z: left→right across the top, pivots and heads
// right→left across the middle, pivots again and exits off the bottom right.
const LEG_MS = 2400 // one length of the screen
const TURN_MS = 420 // the pivot at each end
const RUN_MS = LEG_MS * 3 + TURN_MS * 2

interface Book {
  id: number
  delay: number
  tx: string
  ty: string
  rot: string
}

const active = ref(false)
const books = ref<Book[]>([])
let bookId = 0
let timer: ReturnType<typeof setTimeout> | null = null

function launch() {
  // Restart cleanly if triggered again mid-run.
  if (timer) clearTimeout(timer)

  // A blizzard of books, each flung in its own random direction, spread across
  // the whole run so he sheds them the entire way.
  books.value = Array.from({ length: 100 }, (_, i) => ({
    id: bookId++,
    delay: 200 + i * ((RUN_MS - 600) / 100),
    tx: `${(Math.random() - 0.5) * 120}vw`, // -60vw … +60vw
    ty: `${15 - Math.random() * 55}vh`, // +15vh … -40vh, so they scatter from any lane
    rot: `${(Math.random() - 0.5) * 1800}deg` // spin either way, up to ~2.5 turns
  }))
  active.value = true

  timer = setTimeout(() => {
    active.value = false
    books.value = []
    timer = null
  }, RUN_MS + 1400)
}

useKonamiCode(launch)

onUnmounted(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="active"
      class="konami-stage"
      aria-hidden="true"
    >
      <div class="konami-runner">
        <!-- Facing flips at each pivot; the squash mid-turn reads as him
             planting a foot and spinning round. -->
        <div class="konami-facing">
          <span class="konami-guy">🏃</span>
        </div>

        <span
          v-for="b in books"
          :key="b.id"
          class="konami-book"
          :style="{
            'animationDelay': `${b.delay}ms`,
            '--tx': b.tx,
            '--ty': b.ty,
            '--rot': b.rot
          }"
        >📚</span>
      </div>
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

/* The whole group runs the Z; books are children so they launch from wherever
   he happens to be. */
.konami-runner {
  position: absolute;
  top: 0;
  left: 0;
  width: 6rem;
  height: 6rem;
  font-size: 6rem;
  line-height: 1;
  animation: konami-run 8.04s forwards;
}

/* Percentages below are the leg/turn boundaries: 2.4s legs either side of
   0.42s pivots, over 8.04s total. */
@keyframes konami-run {
  /* top lane, left → right */
  0% { transform: translate(-18vw, 6vh); animation-timing-function: linear; }
  29.85% { transform: translate(96vw, 6vh); animation-timing-function: ease-in-out; }
  /* pivot down to the middle lane */
  35.07% { transform: translate(96vw, 44vh); animation-timing-function: linear; }
  /* middle lane, right → left */
  64.93% { transform: translate(0vw, 44vh); animation-timing-function: ease-in-out; }
  /* pivot down to the bottom lane */
  70.15% { transform: translate(0vw, 76vh); animation-timing-function: linear; }
  /* bottom lane, left → right, off the edge */
  100% { transform: translate(120vw, 76vh); }
}

/* Compounds with the emoji's own flip below, so he always faces the way he's
   travelling; pinching to nothing mid-pivot reads as the turn. */
.konami-facing {
  width: 100%;
  height: 100%;
  animation: konami-face 8.04s forwards;
}

@keyframes konami-face {
  0%, 29.85% { transform: scaleX(1); }
  32.46% { transform: scaleX(0.12); }
  35.07%, 64.93% { transform: scaleX(-1); }
  67.54% { transform: scaleX(0.12); }
  70.15%, 100% { transform: scaleX(1); }
}

/* The emoji is drawn facing left, so flip it once here; the animation above
   does the rest. Bobs on `translate` so it doesn't fight that flip. */
.konami-guy {
  display: inline-block;
  transform: scaleX(-1);
  animation: konami-bob 0.32s ease-in-out infinite;
}

@keyframes konami-bob {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -9px; }
}

/* Each book flings off in its own random direction, tumbling and fading. */
.konami-book {
  position: absolute;
  left: 2rem;
  top: 3rem;
  font-size: 2.5rem;
  opacity: 0;
  animation: konami-toss 1.3s ease-out forwards;
}

@keyframes konami-toss {
  0% { opacity: 0; transform: translate(0, 0) rotate(0deg); }
  12% { opacity: 1; }
  100% {
    opacity: 0;
    transform: translate(var(--tx, -42vw), var(--ty, -32vh)) rotate(var(--rot, 720deg));
  }
}

@media (prefers-reduced-motion: reduce) {
  .konami-runner,
  .konami-facing { animation-duration: 14s; }
  .konami-guy { animation: none; }
  .konami-book { animation-duration: 2s; }
}
</style>
