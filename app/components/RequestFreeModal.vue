<script setup lang="ts">
import type { RequestItem } from '#shared/catalog'
import { byStrength } from '#shared/identity'
import type { BookRequest } from '~~/server/utils/requests'

// The whole set of items is posted as ONE request — an order a sponsor funds in
// full — rather than a separate posting per title.
const props = withDefaults(defineProps<{
  items: RequestItem[]
  triggerLabel?: string
  disabled?: boolean
}>(), {
  triggerLabel: 'Request a free copy',
  disabled: false
})

// The parent owns the items, so it decides what to do with them once the
// request is on the board — the cart page empties itself.
const emit = defineEmits<{ submitted: [] }>()

const open = ref(false)
const loading = ref(false)
const toast = useToast()
const route = useRoute()
const router = useRouter()

const { identities, verified, refresh: refreshProof } = useIdentityProof()
const { signedIn, refresh: refreshAccount } = useSignedIn()
const attached = computed(() => byStrength(identities.value))
const checkingAccount = ref(false)
const deliveryAddresses = ref<Pick<BookRequest, 'id' | 'name' | 'address'>[]>([])
const addressesLoading = ref(false)
const addressesError = ref('')
const selectedAddress = ref('')

// Only one dialog is open at a time. Returning from the provider or losing a
// session selects the appropriate step without discarding the request draft.
const loginOpen = computed({
  get: () => open.value && !signedIn.value?.email,
  set: (value: boolean) => { if (!value) open.value = false }
})
const accountOpen = computed({
  get: () => open.value && Boolean(signedIn.value?.email) && !verified.value,
  set: (value: boolean) => { if (!value) open.value = false }
})
const requestOpen = computed({
  get: () => open.value && Boolean(signedIn.value?.email) && verified.value,
  set: (value: boolean) => { if (!value) open.value = false }
})

async function beginRequest() {
  if (checkingAccount.value) return
  checkingAccount.value = true
  try {
    await Promise.all([refreshAccount(), refreshProof()])
    open.value = true
  } finally {
    checkingAccount.value = false
  }
}

// The challenge means leaving the site, so the modal can't survive the round
// trip on its own. It asks the provider to come back to this page with a marker
// and reopens itself — otherwise the reader lands back on the cart wondering
// whether anything happened.
const REOPEN_FLAG = 'request'

const challengeRedirect = computed(() =>
  router.resolve({ path: route.path, query: { ...route.query, [REOPEN_FLAG]: '1' } }).fullPath)

const formId = useId()

const form = reactive({
  name: '',
  email: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US'
})

watch([requestOpen, () => signedIn.value?.accountId], async ([isOpen], _previous, onCleanup) => {
  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })
  deliveryAddresses.value = []
  selectedAddress.value = ''
  addressesError.value = ''
  addressesLoading.value = false
  if (!isOpen) return
  addressesLoading.value = true
  try {
    const addresses = await $fetch('/api/account/delivery-addresses')
    if (!cancelled) deliveryAddresses.value = addresses
  } catch {
    if (!cancelled) addressesError.value = 'Could not load your previous addresses. You can enter your delivery details below.'
  } finally {
    if (!cancelled) addressesLoading.value = false
  }
})

function chooseAddress(id: string) {
  selectedAddress.value = id
  const saved = deliveryAddresses.value.find(address => address.id === id)
  Object.assign(form, saved
    ? {
        name: saved.name, ...saved.address,
        line2: saved.address.line2 || '', state: saved.address.state || ''
      }
    : {
        name: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US'
      })
}

function reset() {
  Object.assign(form, {
    name: '', email: '',
    line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US'
  })
}

// What we filled in from the verified account, as opposed to what the reader
// typed. Kept so that switching accounts can update those values while leaving
// edited ones alone — a shipping name is often not the name on the account.
const prefilled = reactive({ name: '', email: '' })

// Verifying means leaving the site part-way through the form, so the draft is
// held across the round trip. sessionStorage rather than localStorage on
// purpose: a draft holds a home address, and this way it dies with the tab.
const DRAFT_KEY = 'dorean-request-draft'
const DRAFT_TTL_MS = 60 * 60 * 1000

/** Anything typed yet? Keeps an empty form from leaving a pointless draft. */
const hasContent = () =>
  Object.entries(form).some(([field, value]) => value !== '' && !(field === 'country' && value === 'US'))

function dropDraft() {
  if (!import.meta.client) return
  try {
    sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // storage blocked; nothing was saved to remove
  }
}

function saveDraft() {
  if (!import.meta.client) return
  if (!hasContent()) return dropDraft()
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), form, prefilled }))
  } catch {
    // storage full or blocked; the form still works, the draft just won't survive
  }
}

function restoreDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as {
      at?: number
      form?: Record<string, string>
      prefilled?: Record<string, string>
    }
    if (!saved.at || Date.now() - saved.at > DRAFT_TTL_MS || !saved.form) return dropDraft()
    // Assign known fields only, so a stale draft from an older shape can't
    // introduce keys the form doesn't have.
    for (const field of Object.keys(form) as (keyof typeof form)[]) {
      if (typeof saved.form[field] === 'string') form[field] = saved.form[field]
    }
    // Restored too, because verifying remounts this component: without it we
    // could no longer tell a value we prefilled from one the reader typed, and
    // switching accounts would leave the previous account's name in place.
    for (const field of Object.keys(prefilled) as (keyof typeof prefilled)[]) {
      if (typeof saved.prefilled?.[field] === 'string') prefilled[field] = saved.prefilled[field]
    }
  } catch {
    dropDraft()
  }
}

onMounted(() => {
  restoreDraft()
  // `prefilled` is watched too: refilling a field with the value it already held
  // changes only `prefilled`, and that still has to reach the draft or the next
  // account switch would think the value was hand-typed.
  watch([form, prefilled], saveDraft, { deep: true })

  if (route.query[REOPEN_FLAG] !== '1') return
  // Wait for hydration before refreshing; otherwise useFetch can reuse the
  // initial payload instead of checking the account returned by the provider.
  onNuxtReady(async () => {
    await beginRequest()
    const { [REOPEN_FLAG]: _flag, ...query } = route.query
    await router.replace({ query })
  })
})

// A provider already told us a name, and sometimes an email, so those fields
// start filled — and refill as accounts come and go, unless the reader has
// edited them since (see `prefilled`). The best-checked account supplies the
// name, because that is the one whose name is most likely to be their real one.
watch([() => open.value, attached, signedIn], ([isOpen]) => {
  if (!isOpen) return
  const best = attached.value[0]
  if (best && (!form.name || form.name === prefilled.name)) {
    form.name = best.name
    prefilled.name = form.name
  }
  form.email = signedIn.value?.email || ''
}, { immediate: true })

async function submit() {
  if (loading.value || props.items.length === 0 || !verified.value || !signedIn.value?.email) return
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
    await $fetch('/api/requests', {
      method: 'POST',
      body: {
        items: props.items,
        name: form.name,
        email: form.email,
        address
      }
    })

    toast.add({
      title: 'Request submitted',
      description: props.items.length > 1
        ? 'Your order is now on the Give a Book board. We’ll email you when a sponsor covers it.'
        : 'Your request is now on the Give a Book board. We’ll email you when a sponsor sends your copy.',
      icon: 'i-lucide-heart-handshake',
      color: 'primary'
    })
    reset()
    dropDraft()
    open.value = false
    emit('submitted')
    await refreshNuxtData('orders')
    await navigateTo('/orders')
  } catch (err) {
    const failure = err as { statusCode?: number, data?: { statusMessage?: string } }
    const message = failure?.data?.statusMessage || 'Something went wrong. Please try again.'
    toast.add({ title: 'Could not submit', description: message, icon: 'i-lucide-triangle-alert', color: 'error' })
    // A lapsed proof is the one failure the form can't explain on its own —
    // re-reading it swaps the form back for the challenge.
    if (failure?.statusCode === 401) await Promise.all([refreshAccount(), refreshProof()])
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <UButton
      :label="triggerLabel"
      :disabled="disabled || items.length === 0"
      :loading="checkingAccount"
      icon="i-lucide-gift"
      color="neutral"
      variant="subtle"
      size="lg"
      block
      @click="beginRequest"
    />

    <UModal
      v-model:open="loginOpen"
      title="Sign in to request books"
      description="First, verify your email address."
      :ui="{ content: 'max-w-lg' }"
    >
      <template #body>
        <EmailSignIn
          :redirect="challengeRedirect"
          @authenticated="refreshProof"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="accountOpen"
      title="Attach a public account"
      description="Let sponsors know who they’re giving to."
      :ui="{ content: 'max-w-lg' }"
    >
      <template #body>
        <IdentityChallenge :redirect="challengeRedirect" />
      </template>
      <template #footer>
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          @click="open = false"
        />
      </template>
    </UModal>

    <UModal
      v-model:open="requestOpen"
      title="Delivery address"
      description="Where should we send your books?"
      :dismissible="!loading"
      :close="!loading"
      :ui="{ content: 'max-w-xl', footer: 'justify-end' }"
    >
      <template #body>
        <form
          :id="formId"
          class="space-y-6"
          @submit.prevent="submit"
        >
          <p
            v-if="addressesLoading"
            role="status"
            class="flex items-center gap-2 text-sm text-muted"
          >
            <UIcon
              name="i-lucide-loader-circle"
              class="size-4 animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            Loading your delivery addresses…
          </p>
          <p
            v-if="addressesError"
            role="status"
            class="text-sm text-muted"
          >
            {{ addressesError }}
          </p>
          <fieldset
            v-if="deliveryAddresses.length"
            class="space-y-3"
          >
            <legend class="mb-2 text-sm font-medium">
              Use an address from an active order
            </legend>
            <label
              v-for="saved in deliveryAddresses"
              :key="saved.id"
              class="flex cursor-pointer items-start gap-3 rounded-lg border border-default p-3 text-sm"
            >
              <input
                type="radio"
                :name="`${formId}-address`"
                :value="saved.id"
                :checked="selectedAddress === saved.id"
                class="mt-1"
                @change="chooseAddress(saved.id)"
              >
              <span>
                <span class="block font-medium">{{ saved.name }}</span>
                <span class="block">{{ [saved.address.line1, saved.address.line2].filter(Boolean).join(', ') }}</span>
                <span class="block">{{ [saved.address.city, saved.address.state, saved.address.postalCode, saved.address.country].filter(Boolean).join(', ') }}</span>
              </span>
            </label>
            <label class="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="radio"
                :name="`${formId}-address`"
                value=""
                :checked="!selectedAddress"
                @change="chooseAddress('')"
              >
              Enter a new address
            </label>
          </fieldset>

          <section class="space-y-4">
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
        </form>
      </template>
      <template #footer>
        <UButton
          label="Cancel"
          color="neutral"
          variant="ghost"
          :disabled="loading"
          @click="open = false"
        />
        <UButton
          type="submit"
          :form="formId"
          label="Place request"
          :loading="loading"
          :disabled="!signedIn?.email || !verified || items.length === 0"
        />
      </template>
    </UModal>
  </div>
</template>
