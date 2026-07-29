<script setup lang="ts">
import { findBook, itemsCopies, MAX_REQUEST_COPIES, summarizeTitles, type RequestItem } from '#shared/catalog'

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

// Asking for a free book requires a public account behind it. Until the reader
// has proved one, the modal shows the challenge in place of the form.
const { proof, identity, verified, refresh: refreshProof } = useIdentityProof()

// The challenge means leaving the site, so the modal can't survive the round
// trip on its own. It asks the provider to come back to this page with a marker
// and reopens itself — otherwise the reader lands back on the cart wondering
// whether anything happened.
const REOPEN_FLAG = 'request'

const challengeRedirect = computed(() =>
  router.resolve({ path: route.path, query: { ...route.query, [REOPEN_FLAG]: '1' } }).fullPath)

onMounted(() => {
  if (route.query[REOPEN_FLAG] !== '1') return
  open.value = true
  const { [REOPEN_FLAG]: _flag, ...query } = route.query
  router.replace({ query })
})

const titles = computed(() =>
  props.items
    .map(item => findBook(item.slug)?.title)
    .filter((t): t is string => Boolean(t)))

// The server rejects an oversized request outright, so say so before the reader
// fills in an address for nothing.
const copies = computed(() => itemsCopies(props.items))
const overCap = computed(() => copies.value > MAX_REQUEST_COPIES)

const summary = computed(() => {
  if (titles.value.length === 0) return ''
  if (titles.value.length > 2) return `these ${titles.value.length} books`
  return summarizeTitles(titles.value.map(t => `“${t}”`))
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

// The provider already told us a name, and usually an email. Filling blanks
// only, so it can never overwrite something the reader has typed — and so the
// shipping name stays theirs to change when it differs from the account.
watch(() => open.value && verified.value, (ready) => {
  const held = proof.value
  if (!ready || !held) return
  if (!form.name) form.name = held.identity.name
  if (!form.email && held.email) form.email = held.email
}, { immediate: true })

async function submit() {
  if (props.items.length === 0 || overCap.value) return
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
        message: form.message,
        name: form.name,
        email: form.email,
        phone: form.phone,
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
    open.value = false
    emit('submitted')
    // The server spent the proof on that request, so re-read it: this modal must
    // ask for a fresh challenge next time rather than appear to still hold one.
    await refreshProof()
  } catch (err) {
    const failure = err as { statusCode?: number, data?: { statusMessage?: string } }
    const message = failure?.data?.statusMessage || 'Something went wrong. Please try again.'
    toast.add({ title: 'Could not submit', description: message, icon: 'i-lucide-triangle-alert', color: 'error' })
    // A lapsed or already-spent proof is the one failure the form can't explain
    // on its own — re-reading it swaps the form back for the challenge.
    if (failure?.statusCode === 401) await refreshProof()
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="items.length > 1 ? 'Request these books' : 'Request a free copy'"
    :description="verified
      ? `Tell us why you’d like ${summary}. Your message appears on the Give a Book board so a sponsor can cover ${items.length > 1 ? 'the whole order' : 'your copy'}. Your contact and address stay private.`
      : `Before you ask for ${summary}, show that a public account stands behind the request so sponsors can see who they're giving to.`"
    :ui="{ content: 'max-w-xl' }"
  >
    <UButton
      :label="triggerLabel"
      :disabled="disabled || items.length === 0"
      icon="i-lucide-gift"
      color="neutral"
      variant="subtle"
      size="lg"
      block
    />

    <template #body>
      <IdentityChallenge
        v-if="!verified"
        :redirect="challengeRedirect"
      />

      <form
        v-else
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UAlert
          v-if="overCap"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`That's ${copies} copies — a free request can be for up to ${MAX_REQUEST_COPIES}`"
          description="Sponsors pay for the printing out of their own pocket, so we keep free requests small. Please trim your cart, or buy the extra copies."
        />

        <div
          v-if="identity"
          class="flex items-center gap-3 rounded-lg bg-elevated/50 p-3"
        >
          <UAvatar
            :src="identity.avatarUrl"
            :alt="identity.name"
            size="sm"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-highlighted">
              {{ identity.name }}
            </p>
            <p class="text-xs text-muted">
              Shown on the board beside your message, so sponsors know who they're giving to.
            </p>
          </div>
        </div>

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
            :disabled="overCap"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
