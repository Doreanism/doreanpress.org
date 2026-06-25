<script setup lang="ts">
import type { Book } from '#shared/catalog'

const props = withDefaults(defineProps<{
  books: Book[]
  triggerLabel?: string
  disabled?: boolean
}>(), {
  triggerLabel: 'Request a free copy',
  disabled: false
})

const open = ref(false)
const loading = ref(false)
const toast = useToast()

const titles = computed(() => props.books.map(b => b.title))
const summary = computed(() => {
  if (titles.value.length === 0) return ''
  if (titles.value.length === 1) return `“${titles.value[0]}”`
  if (titles.value.length === 2) return `“${titles.value[0]}” and “${titles.value[1]}”`
  return `${titles.value.length} books from your cart`
})

const form = reactive({
  message: '',
  name: '',
  email: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US'
})

function reset() {
  Object.assign(form, {
    message: '', name: '', email: '', phone: '',
    line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US'
  })
}

async function submit() {
  if (props.books.length === 0) return
  loading.value = true
  try {
    const address = {
      line1: form.line1,
      line2: form.line2,
      city: form.city,
      state: form.state,
      postalCode: form.postalCode,
      country: form.country
    }
    // One request per distinct book, sharing the same message + address.
    await Promise.all(props.books.map(book => $fetch('/api/requests', {
      method: 'POST',
      body: {
        bookSlug: book.slug,
        message: form.message,
        name: form.name,
        email: form.email,
        phone: form.phone,
        address
      }
    })))

    toast.add({
      title: props.books.length > 1 ? 'Requests submitted' : 'Request submitted',
      description: 'Your request is now on the Give a Book board. We’ll email you when a sponsor sends your copy.',
      icon: 'i-lucide-heart-handshake',
      color: 'primary'
    })
    reset()
    open.value = false
  } catch (err) {
    const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage || 'Something went wrong. Please try again.'
    toast.add({ title: 'Could not submit', description: message, icon: 'i-lucide-triangle-alert', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Request a free copy"
    :description="`Tell us why you’d like ${summary}. Your message appears on the Give a Book board so a sponsor can send you a copy. Your contact and address stay private.`"
    :ui="{ content: 'max-w-xl' }"
  >
    <UButton
      :label="triggerLabel"
      :disabled="disabled || books.length === 0"
      icon="i-lucide-gift"
      color="neutral"
      variant="subtle"
      size="lg"
      block
    />

    <template #body>
      <form
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UFormField
          label="Your request"
          required
          hint="shown publicly"
        >
          <UTextarea
            v-model="form.message"
            :rows="4"
            class="w-full"
            placeholder="Write your request here — a sentence or two about who you are and why a copy would help."
            maxlength="1000"
          />
        </UFormField>

        <USeparator label="Where to ship it (private)" />

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField
            label="Full name"
            required
          >
            <UInput
              v-model="form.name"
              class="w-full"
              autocomplete="name"
            />
          </UFormField>
          <UFormField
            label="Email"
            required
          >
            <UInput
              v-model="form.email"
              type="email"
              class="w-full"
              autocomplete="email"
            />
          </UFormField>
          <UFormField
            label="Phone"
            required
            hint="for the courier"
          >
            <UInput
              v-model="form.phone"
              type="tel"
              class="w-full"
              autocomplete="tel"
            />
          </UFormField>
          <UFormField
            label="Country"
            required
            hint="2-letter code"
          >
            <UInput
              v-model="form.country"
              class="w-full"
              placeholder="US"
              autocomplete="country"
            />
          </UFormField>
        </div>

        <UFormField
          label="Address line 1"
          required
        >
          <UInput
            v-model="form.line1"
            class="w-full"
            autocomplete="address-line1"
          />
        </UFormField>
        <UFormField label="Address line 2">
          <UInput
            v-model="form.line2"
            class="w-full"
            autocomplete="address-line2"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <UFormField
            label="City"
            required
          >
            <UInput
              v-model="form.city"
              class="w-full"
              autocomplete="address-level2"
            />
          </UFormField>
          <UFormField label="State / region">
            <UInput
              v-model="form.state"
              class="w-full"
              autocomplete="address-level1"
            />
          </UFormField>
          <UFormField
            label="Postal code"
            required
          >
            <UInput
              v-model="form.postalCode"
              class="w-full"
              autocomplete="postal-code"
            />
          </UFormField>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="open = false"
          />
          <UButton
            type="submit"
            label="Submit request"
            icon="i-lucide-send"
            color="primary"
            :loading="loading"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
