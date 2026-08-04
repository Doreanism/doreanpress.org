<script setup lang="ts">
import { findBook, summarizeTitles, type RequestItem } from '#shared/catalog'
import { accountKey, byStrength, MAX_ATTACHED, providerLabel, type RequesterIdentity } from '#shared/identity'

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
const { identities, email: providerEmail, verified, refresh: refreshProof } = useIdentityProof()

/** Attached accounts, best-checked first, as the board will draw them. */
const attached = computed(() => byStrength(identities.value))

/** Room for another, or the picker stands down and says why. */
const canAttachMore = computed(() => identities.value.length < MAX_ATTACHED)

/**
 * How much of the allowance is used, once any of it is.
 *
 * Shown from the first profile onward rather than only at the ceiling, so the
 * limit is something a reader is working within rather than something they run
 * into. Before that the picker's own copy states it — see the `limit` prop —
 * and saying it twice on an empty form would be nagging.
 */
const attachedCount = computed(() => {
  const used = identities.value.length
  const left = MAX_ATTACHED - used
  return left > 0
    ? `${used} of ${MAX_ATTACHED} profiles attached — room for ${left} more.`
    : `${used} of ${MAX_ATTACHED} profiles attached, which is as many as one request can carry.`
})

const proved = (identity: RequesterIdentity) => identity.confirmation === 'control'
const told = (identity: RequesterIdentity) => identity.confirmation === 'claimed'

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
  open.value = true
  const { [REOPEN_FLAG]: _flag, ...query } = route.query
  router.replace({ query })
})

// A provider already told us a name, and sometimes an email, so those fields
// start filled — and refill as accounts come and go, unless the reader has
// edited them since (see `prefilled`). The best-checked account supplies the
// name, because that is the one whose name is most likely to be their real one.
watch([() => open.value, attached, providerEmail], ([isOpen]) => {
  if (!isOpen) return
  const best = attached.value[0]
  if (best && (!form.name || form.name === prefilled.name)) {
    form.name = best.name
    prefilled.name = form.name
  }
  if (providerEmail.value && (!form.email || form.email === prefilled.email)) {
    form.email = providerEmail.value
    prefilled.email = form.email
  }
}, { immediate: true })

// Detach one account, leaving the others. The draft is untouched — only what is
// attached changes.
const detaching = ref<string | null>(null)

async function detach(identity: RequesterIdentity) {
  const key = accountKey(identity)
  detaching.value = key
  try {
    await $fetch('/api/verify/discard', { method: 'POST', body: { account: key } })
  } catch {
    // Even if the call fails, re-reading below tells us where we actually stand.
  } finally {
    await refreshProof()
    detaching.value = null
  }
}

async function submit() {
  if (props.items.length === 0 || !verified.value) return
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
  } catch (err) {
    const failure = err as { statusCode?: number, data?: { statusMessage?: string } }
    const message = failure?.data?.statusMessage || 'Something went wrong. Please try again.'
    toast.add({ title: 'Could not submit', description: message, icon: 'i-lucide-triangle-alert', color: 'error' })
    // A lapsed proof is the one failure the form can't explain on its own —
    // re-reading it swaps the form back for the challenge.
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
    :description="`Tell us why you’d like ${summary}. The profiles you attach and your message appear on the Give a Book board so a sponsor can see who they're covering; your contact details and address stay private.`"
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
        <!--
          The public account comes first, because it is the part that decides
          whether the request can be posted at all. The rest of the form stays
          visible below it either way — a reader should be able to see what is
          being asked before deciding to hand over an account.
        -->
        <USeparator label="Your public accounts" />

        <p
          v-if="attached.length"
          class="text-xs text-dimmed"
        >
          {{ attachedCount }}
        </p>

        <!--
          Every account attached, each saying what the board will say about it,
          in the same words — so posting holds no surprise about how the request
          will read to a sponsor. Strongest first, as the board draws them.
        -->
        <div
          v-for="identity in attached"
          :key="`${identity.provider}:${identity.subject}`"
          class="flex flex-wrap items-center gap-3 rounded-lg bg-elevated/50 p-3"
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
                :name="told(identity) ? 'i-lucide-message-square-quote' : proved(identity) ? 'i-lucide-badge-check' : 'i-lucide-search-check'"
                class="size-4 shrink-0"
                :class="proved(identity) ? 'text-primary' : 'text-dimmed'"
              />
              <span class="truncate text-xs font-normal text-dimmed">
                {{ identity.handle ? `@${identity.handle}` : providerLabel(identity.provider) }}
              </span>
            </p>
            <p
              v-if="proved(identity)"
              class="text-xs text-muted"
            >
              Verified, and shown on the board beside your message so sponsors know who
              they're giving to.
            </p>
            <p
              v-else-if="told(identity)"
              class="text-xs text-muted"
            >
              Shown on the board beside your message. Because we can't check this one at
              all, your request will say you told us about it and we took your word —
              with a link so a sponsor can look for themselves.
            </p>
            <p
              v-else
              class="text-xs text-muted"
            >
              Found, and shown on the board beside your message. Because you didn't sign
              in, your request will say this account is real but wasn't proved to be
              yours.
            </p>
          </div>
          <UButton
            label="Remove"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            :loading="detaching === `${identity.provider}:${identity.subject}`"
            @click="detach(identity)"
          />
        </div>

        <!--
          The picker stays put once something is attached, because attaching a
          second profile is the ordinary case rather than a correction: the
          account a reader's friends know them by and the one that can actually
          be checked are rarely the same account.
        -->
        <IdentityChallenge
          v-if="canAttachMore"
          :redirect="challengeRedirect"
          :adding="attached.length > 0"
          :limit="MAX_ATTACHED"
        />
        <p
          v-else
          class="text-xs text-dimmed"
        >
          Remove one to attach a different one.
        </p>

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
            Attach at least one public profile above to post this request. Anything you've
            typed is kept while you do.
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
            :disabled="!verified"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>
