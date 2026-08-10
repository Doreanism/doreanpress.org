/**
 * Fires `onUnlock` when the reader types `word` anywhere on the page.
 *
 * A rolling buffer of the last `word.length` keys rather than a progress
 * counter: a counter has to decide what a mismatch means, and gets it wrong on
 * any word whose prefix repeats inside it — "freely" is safe, but the next word
 * chosen might not be, and this costs nothing to be right about.
 *
 * Client-only; the listener is torn down automatically on unmount.
 */
export function useSecretWord(word: string, onUnlock: () => void) {
  if (import.meta.server) return

  const target = word.toLowerCase()
  let typed = ''

  function onKeydown(e: KeyboardEvent) {
    // Whatever the reader is writing is theirs. The word is short and ordinary
    // enough to appear in a Give a Book message or a search box, and an easter
    // egg that goes off mid-sentence is a bug wearing a costume.
    const el = e.target as HTMLElement | null
    if (el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName ?? '')) return

    // A shortcut is not typing. Without this, Ctrl+F then "reely" would arm it.
    if (e.ctrlKey || e.metaKey || e.altKey) return

    // Named keys (Shift, Enter, arrows) are one character of nothing; letting
    // them through would only break a word the reader is part-way into.
    if (e.key.length !== 1) return

    typed = (typed + e.key.toLowerCase()).slice(-target.length)
    if (typed === target) {
      typed = ''
      onUnlock()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeydown))
  onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
