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

// Asking for a free book requires a public account behind it, so that is the
// first thing the form asks for — see the template. The rest of the form stays
// visible underneath, because a reader deciding whether to bother should be able
// to see everything being asked of them, not just the gate.
const { proof, identity, verified, refresh: refreshProof } = useIdentityProof()

// The challenge means leaving the site, so the modal can't survive the round
// trip on its own. It asks the provider to come back to this page with a marker
// and reopens itself — otherwise the reader lands back on the cart wondering
// whether anything happened.
const REOPEN_FLAG = 'request'

const challengeRedirect = computed(() =>
  router.resolve({ path: route.path, query: { ...route.query, [REOPEN_FLAG]: '1' } }).fullPath)

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
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), form }))
  } catch {
    // storage full or blocked; the form still works, the draft just won't survive
  }
}

function restoreDraft() {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as { at?: number, form?: Record<string, string> }
    if (!saved.at || Date.now() - saved.at > DRAFT_TTL_MS || !saved.form) return dropDraft()
    // Assign known fields only, so a stale draft from an older shape can't
    // introduce keys the form doesn't have.
    for (const field of Object.keys(form) as (keyof typeof form)[]) {
      if (typeof saved.form[field] === 'string') form[field] = saved.form[field]
    }
  } catch {
    dropDraft()
  }
}

onMounted(() => {
  restoreDraft()
  watch(form, saveDraft, { deep: true })

  if (route.query[REOPEN_FLAG] !== '1') return
  open.value = true
  const { [REOPEN_FLAG]: _flag, ...query } = route.query
  router.replace({ query })
})

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
  if (props.items.length === 0 || overCap.value || !verified.value) return
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
    dropDraft()
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
    :description="`Tell us why you’d like ${summary}. Your public account and your message appear on the Give a Book board so a sponsor can see who they're covering; your contact details and address stay private.`"
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
      <form
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

        <!--
          The public account comes first, because it is the part that decides
          whether the request can be posted at all. The rest of the form stays
          visible below it either way — a reader should be able to see what is
          being asked before deciding to hand over an account.
        -->
        <USeparator label="Your public account" />

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
            <p class="flex items-center gap-1.5 text-sm font-medium text-highlighted">
              <span class="truncate">{{ identity.name }}</span>
              <UIcon
                name="i-lucide-badge-check"
                class="size-4 shrink-0 text-primary"
              />
            </p>
            <p class="text-xs text-muted">
              Verified, and shown on the board beside your message so sponsors know who
              they're giving to.
            </p>
          </div>
        </div>

        <IdentityChallenge
          v-else
          :redirect="challengeRedirect"
        />

        <USeparator label="Why you'd like them" />

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

        <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
          <p
            v-if="!verified"
            class="mr-auto text-xs text-dimmed"
          >
            Verify your account above to post this request. Anything you've typed is kept
            while you do.
          </p>
          <UButton
            label="Cancel"
            color="neutral"
            variant="ghost"
            @click="open = false"
          />
          <!--
            Recedes until the account is verified. Nuxt UI's disabled state alone
            is a slight dimming, which on a solid primary button still reads as
            "press me" — and a bright button that does nothing is worse than an
            obviously inactive one.
          -->
          <UButton
            type="submit"
            label="Submit request"
            icon="i-lucide-send"
            :color="verified ? 'primary' : 'neutral'"
            :variant="verified ? 'solid' : 'subtle'"
            :loading="loading"
            :disabled="overCap || !verified"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
