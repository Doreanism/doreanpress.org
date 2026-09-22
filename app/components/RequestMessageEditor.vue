<script setup lang="ts">
const props = defineProps<{ requestId: string, message: string }>()
const emit = defineEmits<{ saved: [request: { id: string, message: string }] }>()
const editing = ref(false)
const draft = ref('')
const saving = ref(false)
const error = ref('')
const toast = useToast()

function edit() {
  draft.value = props.message
  error.value = ''
  editing.value = true
}

async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    const updated = await $fetch(`/api/requests/${props.requestId}`, {
      method: 'PATCH', body: { message: draft.value }
    })
    emit('saved', { id: updated.id, message: updated.message })
    editing.value = false
    toast.add({ title: 'Message saved', color: 'primary' })
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } }).data?.statusMessage
      || 'Could not save your message. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <template v-if="!editing">
      <RequestMessage
        v-if="message"
        :message="message"
      />
      <UButton
        :label="message ? 'Edit message' : 'Add message'"
        icon="i-lucide-message-square"
        variant="link"
        size="sm"
        class="px-0"
        @click="edit"
      />
    </template>
    <form
      v-else
      class="space-y-3"
      @submit.prevent="save"
    >
      <UFormField
        label="Message to sponsors"
        hint="optional"
        help="Tell sponsors how you’ll use the books. Your message is public."
      >
        <UTextarea
          v-model="draft"
          :rows="4"
          class="w-full"
          placeholder="I’d like to read this because…"
          required
          minlength="5"
          maxlength="1000"
          :disabled="saving"
        />
      </UFormField>
      <p
        v-if="error"
        role="alert"
        class="text-sm text-error"
      >
        {{ error }}
      </p>
      <div class="flex gap-2">
        <UButton
          type="submit"
          label="Save message"
          :loading="saving"
          :disabled="draft.trim().length < 5"
        />
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          :disabled="saving"
          @click="editing = false"
        />
      </div>
    </form>
  </div>
</template>
