<script setup lang="ts">
// Easter egg: enter the Konami code and a little guy sprints across the
// screen tossing books over his shoulder. Purely decorative.
const RUN_MS = 3400

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

  // A blizzard of books, each flung in its own random direction.
  books.value = Array.from({ length: 100 }, (_, i) => ({
    id: bookId++,
    delay: 250 + i * 30,
    tx: `${(Math.random() - 0.5) * 120}vw`, // -60vw … +60vw
    ty: `${-10 - Math.random() * 55}vh`, // mostly upward, -10 … -65vh
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
        <span class="konami-guy">🏃</span>
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

/* The whole group dashes left → right; books are children so they launch
   from wherever the runner currently is. */
.konami-runner {
  position: absolute;
  bottom: 12%;
  left: 0;
  font-size: 6rem;
  line-height: 1;
  animation: konami-run 3.4s linear forwards;
}

@keyframes konami-run {
  from { transform: translateX(-15vw); }
  to { transform: translateX(115vw); }
}

/* Flip so he faces his direction of travel, plus a running bob. */
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
  bottom: 1rem;
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
  .konami-runner { animation-duration: 6s; }
  .konami-guy { animation: none; }
  .konami-book { animation-duration: 2s; }
}
</style>
