<script setup lang="ts">
import { findBook, type RequestItem } from '#shared/catalog'

const props = defineProps<{ request: { id: string, items: RequestItem[] } }>()
const open = ref(false)
const draft = ref<RequestItem[]>([])
const originalItems = ref<RequestItem[]>([])
const saving = ref(false)
const error = ref('')
const toast = useToast()
const selected = computed(() => draft.value.filter(item => item.quantity > 0))
const valid = computed(() => selected.value.length > 0
  && draft.value.every(item => Number.isInteger(item.quantity) && item.quantity >= 0 && item.quantity <= 99))

watch(open, (value) => {
  if (!value) return
  originalItems.value = props.request.items.map(item => ({ ...item }))
  draft.value = props.request.items.map(item => ({ ...item }))
  error.value = ''
})

async function save() {
  if (saving.value || !valid.value) return
  saving.value = true
  error.value = ''
  try {
    await $fetch(`/api/requests/${props.request.id}`, {
      method: 'PATCH', body: { items: selected.value, originalItems: originalItems.value }
    })
    open.value = false
    toast.add({ title: 'Request updated', color: 'primary' })
    await refreshNuxtData('orders')
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } }).data?.statusMessage
      || 'Could not save your changes. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Edit requested books"
    description="Adjust the number of copies. Set a book to zero to remove it."
    :dismissible="!saving"
    :close="!saving"
    :ui="{ content: 'max-w-lg', footer: 'justify-end' }"
  >
    <UButton
      aria-label="Edit books"
      icon="i-lucide-pencil"
      type="button"
      title="Edit books"
      class="size-8 shrink-0 cursor-pointer justify-center"
      color="neutral"
      variant="outline"
      size="sm"
    />
    <template #body>
      <div class="space-y-4">
        <div
          v-for="item in draft"
          :key="item.slug"
          class="flex flex-wrap items-center justify-between gap-3"
        >
          <span class="min-w-0 flex-1 font-medium">{{ findBook(item.slug)?.title || item.slug }}</span>
          <UInputNumber
            v-model="item.quantity"
            :min="0"
            :max="99"
            :disabled="saving"
            :aria-label="`Copies of ${findBook(item.slug)?.title || item.slug}`"
            class="w-32"
          />
        </div>
        <p
          v-if="!selected.length"
          class="text-sm text-muted"
        >
          Keep at least one book, or close this dialog and use the trash icon to remove the request.
        </p>
        <p
          v-if="error"
          role="alert"
          class="text-sm text-error"
        >
          {{ error }}
        </p>
      </div>
    </template>
    <template #footer>
      <UButton
        label="Save changes"
        :loading="saving"
        :disabled="!valid"
        @click="save"
      />
    </template>
  </UModal>
</template>
