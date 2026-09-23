<script setup lang="ts">
import type { RequestAddress } from '~~/server/utils/requests'

interface Destination {
  id: string
  name: string
  address: RequestAddress
  requests: { status: string }[]
}
const props = defineProps<{
  requestId: string
  name: string
  address: RequestAddress
  alternatives: Destination[]
  canMerge: boolean
}>()
const open = ref(false)
const selected = ref('')
const saving = ref(false)
const error = ref('')
const formId = useId()
const toast = useToast()
const form = reactive({ name: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: '' })
const originalDestination = ref({ name: props.name, address: { ...props.address } })
const chosen = computed(() => props.alternatives.find(option => option.id === selected.value))
const willMerge = computed(() => props.canMerge && chosen.value?.requests.some(request => request.status === 'open'))

watch(open, (value) => {
  if (!value) return
  selected.value = ''
  error.value = ''
  originalDestination.value = { name: props.name, address: { ...props.address } }
  Object.assign(form, { name: props.name, ...props.address, line2: props.address.line2 || '', state: props.address.state || '' })
})

async function save() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    const { name, ...address } = form
    const result = await $fetch(`/api/requests/${props.requestId}/address`, {
      method: 'PATCH',
      body: { name, address, targetRequestId: selected.value || undefined, originalDestination: originalDestination.value }
    })
    open.value = false
    toast.add({ title: result.merged ? 'Requests merged' : 'Delivery address updated', color: 'primary' })
    await refreshNuxtData('orders')
    await navigateTo({ path: '/orders', hash: `#request-${result.id}` })
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } }).data?.statusMessage
      || 'Could not update the address. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Edit delivery address"
    description="Update the address for unshipped books. Donated quantities cannot be changed."
    :dismissible="!saving"
    :close="!saving"
    :ui="{ content: 'max-w-xl', footer: 'justify-end' }"
  >
    <UButton
      aria-label="Edit address"
      title="Edit address"
      icon="i-lucide-pencil"
      class="size-8 shrink-0 cursor-pointer justify-center self-start"
      color="neutral"
      variant="outline"
      size="sm"
    />
    <template #body>
      <form
        :id="formId"
        class="space-y-6"
        @submit.prevent="save"
      >
        <fieldset
          :disabled="saving"
          class="space-y-6"
        >
          <fieldset
            v-if="alternatives.length"
            class="space-y-3"
          >
            <legend class="mb-2 text-sm font-medium">
              Use an address from another active order
            </legend>
            <label
              v-for="option in alternatives"
              :key="option.id"
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-default p-3 text-sm"
            >
              <input
                v-model="selected"
                type="radio"
                :name="`${formId}-address`"
                :value="option.id"
                class="mt-1"
              >
              <span>
                <span class="block font-medium">{{ option.name }}</span>
                <span class="block">{{ [option.address.line1, option.address.line2].filter(Boolean).join(', ') }}</span>
                <span class="block">{{ [option.address.city, option.address.state, option.address.postalCode, option.address.country].filter(Boolean).join(', ') }}</span>
              </span>
            </label>
            <label class="flex cursor-pointer items-center gap-3 text-sm">
              <input
                v-model="selected"
                type="radio"
                :name="`${formId}-address`"
                value=""
              >
              Edit the address below
            </label>
          </fieldset>
          <p class="text-sm text-muted">
            {{ selected
              ? willMerge
                ? 'These open requests will become one order. Book quantities will be added together and both messages kept.'
                : 'Unshipped books will use the selected address. Donated quantities stay unchanged.'
              : canMerge ? 'If the recipient and address match another open order, the unfunded requests will be merged.' : 'Update the delivery address below.' }}
          </p>
          <p class="text-sm text-muted">
            Orders already placed with the printer will be flagged for an address update before shipping.
          </p>
          <section
            v-if="!selected"
            class="space-y-4"
          >
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <UFormField
                label="Full name"
                required
              >
                <UInput
                  v-model="form.name"
                  required
                  class="w-full"
                  autocomplete="name"
                />
              </UFormField>
              <UFormField
                label="Country"
                required
                hint="2-letter code"
              >
                <UInput
                  v-model="form.country"
                  required
                  minlength="2"
                  maxlength="2"
                  pattern="[A-Za-z]{2}"
                  class="w-full"
                  placeholder="US"
                  autocomplete="country"
                />
              </UFormField>
            </div>

            <UFormField
              label="Street address"
              required
            >
              <UInput
                v-model="form.line1"
                required
                class="w-full"
                autocomplete="address-line1"
              />
            </UFormField>
            <UFormField
              label="Apartment, suite, etc."
              hint="optional"
            >
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
                  required
                  class="w-full"
                  autocomplete="address-level2"
                />
              </UFormField>
              <UFormField
                label="State"
              >
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
                  required
                  class="w-full"
                  autocomplete="postal-code"
                />
              </UFormField>
            </div>
          </section>
        </fieldset>
        <p
          v-if="error"
          role="alert"
          class="text-sm text-error"
        >
          {{ error }}
        </p>
      </form>
    </template>
    <template #footer>
      <UButton
        label="Cancel"
        color="neutral"
        variant="ghost"
        :disabled="saving"
        @click="open = false"
      />
      <UButton
        type="submit"
        :form="formId"
        :label="willMerge ? 'Merge requests' : 'Save address'"
        :loading="saving"
      />
    </template>
  </UModal>
</template>
