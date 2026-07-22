// Classic Konami cheat code: ↑ ↑ ↓ ↓ ← → ← → B A
const SEQUENCE = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a'
]

/**
 * Listens for the Konami code and fires `onUnlock` when it's entered.
 * Client-only; the listener is torn down automatically on unmount.
 */
export function useKonamiCode(onUnlock: () => void) {
  if (import.meta.server) return

  let progress = 0

  function onKeydown(e: KeyboardEvent) {
    // Single characters (b, a) are matched case-insensitively; named keys (arrows) as-is.
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

    if (key === SEQUENCE[progress]) {
      progress++
      if (progress === SEQUENCE.length) {
        progress = 0
        onUnlock()
      }
    } else {
      // A wrong key resets — but a fresh first key still counts as a restart.
      progress = key === SEQUENCE[0] ? 1 : 0
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
