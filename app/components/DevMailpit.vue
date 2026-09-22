<script setup lang="ts">
const unread = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | undefined
let fetching = false
async function refresh() {
  if (!import.meta.dev || fetching || document.visibilityState === 'hidden') return
  fetching = true
  try {
    unread.value = (await $fetch('/api/dev/mailpit')).unread
  } catch {
    unread.value = null
  } finally {
    fetching = false
  }
}
onMounted(() => {
  if (!import.meta.dev) return
  refresh()
  timer = setInterval(refresh, 10000)
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('focus', refresh)
  document.removeEventListener('visibilitychange', refresh)
})
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50">
    <UChip
      :show="unread !== null && unread > 0"
      :text="unread ?? undefined"
      size="3xl"
      color="error"
    >
      <UButton
        to="http://localhost:8025"
        target="_blank"
        rel="noopener noreferrer"
        external
        icon="i-lucide-mail"
        label="Dev · Mailpit"
        color="warning"
        size="sm"
        class="shadow-lg"
        :aria-label="unread === null ? 'Open Mailpit development inbox' : `Open Mailpit development inbox, ${unread} unread emails`"
      />
    </UChip>
  </div>
</template>
