<script setup lang="ts">
import type { RequestItem } from '#shared/catalog'

const props = defineProps<{ request: { id: string, items: RequestItem[] } }>()
const emit = defineEmits<{ removed: [] }>()
const open = ref(false)
const removing = ref(false)
const toast = useToast()

async function remove() {
  if (removing.value) return
  removing.value = true
  try {
    await $fetch(`/api/requests/${props.request.id}`, { method: 'DELETE' })
    open.value = false
    toast.add({
      title: 'Request removed',
      description: 'You can ask again any time.',
      icon: 'i-lucide-check',
      color: 'primary'
    })
    emit('removed')
    await refreshNuxtData('orders')
  } catch (err) {
    const failure = err as { statusCode?: number, data?: { statusMessage?: string } }
    if (failure?.statusCode === 401) {
      await navigateTo(`/give/withdraw?id=${props.request.id}`)
      return
    }
    toast.add({
      title: 'Could not remove it',
      description: failure?.data?.statusMessage || 'Please try again.',
      icon: 'i-lucide-triangle-alert',
      color: 'error'
    })
  } finally {
    removing.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Remove your request?"
    description="Sponsors will no longer see this request. You can submit a new request any time."
    :dismissible="!removing"
    :close="!removing"
    :ui="{ content: 'max-w-lg', footer: 'justify-end flex-wrap' }"
  >
    <UButton
      aria-label="Remove my request"
      icon="i-lucide-trash-2"
      color="neutral"
      variant="link"
      size="sm"
      :loading="removing"
    />
    <template #body>
      <RequestBooks :items="request.items" />
    </template>
    <template #footer>
      <UButton
        label="Remove my request"
        icon="i-lucide-trash-2"
        color="error"
        :loading="removing"
        @click="remove"
      />
    </template>
  </UModal>
</template>
