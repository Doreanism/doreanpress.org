<script setup lang="ts">
// Puts a public account behind a request, by whichever of three routes the
// reader has one for.
//
// Not a login. There is no account to create, no password, and nothing is
// remembered afterwards — the copy below is careful not to imply otherwise.
//
// One row of logos, not three panels. A reader knows which social media they
// are on long before they know which of our three checks it happens to support,
// so the question asked first is theirs — "where can we find you?" — every
// answer to it is on screen at once, and the route follows from the answer.
//
// What must survive that merge is the thing the three routes differ on. Signing
// in proves the account is the reader's. Naming one for us to read only proves
// it is there. Telling us about one proves nothing whatever. The row itself
// stays out of that argument — it is ordered by how many people are on each
// thing and otherwise just names places — and the promise for the chosen
// provider is spelled out the moment one is picked, before anything is typed.
// It is never left to be inferred from a missing tick, because a sponsor is
// about to spend money on the difference.
//
// The provider lists come from the server rather than being hard-coded, so a
// deployment that has only configured one of them never shows a button that
// dead-ends on the provider's error page, and no provider ever appears under
// two routes at once.

import { providerLabel, type IdentityProvider, type RequesterIdentity } from '#shared/identity'

interface ChallengeOption {
  id: IdentityProvider
  label: string
  icon: string
}

interface NamedOption extends ChallengeOption {
  accountHint: string
  accountExample: string
}

const props = withDefaults(defineProps<{
  /** Where to land once the challenge passes. Defaults to the page we're on. */
  redirect?: string
  /**
   * Whether something is already attached, which changes what this is asking.
   * The long explanation of why an account is wanted at all has been read by
   * then; repeating it above every extra profile would be nagging.
   */
  adding?: boolean
  /**
   * How many profiles the thing being attached to can carry, where there is a
   * limit — so the allowance is stated before the reader starts rather than
   * discovered by hitting it.
   *
   * Left undefined when the reader is proving one particular account instead of
   * building a set, as on the withdraw page: a number there would answer a
   * question nobody asked, and imply they should attach four to take one
   * request down.
   */
  limit?: number
}>(), { adding: false })

const emit = defineEmits<{ confirmed: [RequesterIdentity] }>()

/**
 * The invitation to attach more than one, with the ceiling named where there is
 * one. Said as an allowance rather than a restriction: the number is here to
 * tell a reader how much room they have, not to warn them off using it.
 */
const allowance = computed(() => props.limit
  ? `You can attach up to ${props.limit} profiles — several together say more than any one of them alone.`
  : 'You can attach more than one — several profiles together say more than any of them alone.')

const route = useRoute()
const { data: providers } = await useFetch<{
  challenge: ChallengeOption[]
  lookup: NamedOption[]
  claim: NamedOption[]
}>('/api/verify/providers', { default: () => ({ challenge: [], lookup: [], claim: [] }) })

const challengeProviders = computed(() => providers.value.challenge)
const lookupProviders = computed(() => providers.value.lookup)
const claimProviders = computed(() => providers.value.claim)

const anyProvider = computed(() =>
  challengeProviders.value.length + lookupProviders.value.length + claimProviders.value.length > 0)

function challengeUrl(provider: IdentityProvider) {
  const params = new URLSearchParams({ redirect: props.redirect || route.fullPath })
  return `/verify/${provider}?${params}`
}

// ── choosing a provider ──
const chosen = ref<IdentityProvider | undefined>()
const account = ref('')
const busy = ref(false)
const error = ref('')

/**
 * Each logo in its own colours, so the list is scanned rather than read.
 *
 * Written as classes rather than an inline style on purpose: the two black
 * marks have to invert on a dark background, and a CSS variant does that
 * without the component having to know which theme is on — which it cannot know
 * on the server anyway, and guessing would mean a hydration mismatch on every
 * row. Full literal strings, because Tailwind only generates what it can see.
 *
 * Purely presentational, so it lives here rather than beside `icon` in the
 * shared identity metadata — the board and the emails describe an account, they
 * don't paint it.
 */
const BRAND: Partial<Record<IdentityProvider, string>> = {
  x: 'text-black dark:text-white',
  facebook: 'text-[#0866FF]',
  linkedin: 'text-[#0A66C2] dark:text-[#4DA3E8]',
  twitch: 'text-[#9146FF]',
  tiktok: 'text-black dark:text-white',
  github: 'text-black dark:text-white',
  bluesky: 'text-[#0285FF]',
  mastodon: 'text-[#6364FF]',
  gitlab: 'text-[#FC6D26]'
}

/**
 * Ordered by where the people asking for books actually are.
 *
 * Not by audience size alone, and not — as it once was — by which we can check
 * best, which was a ranking of our own convenience wearing the clothes of an
 * explanation. The three a general reader is overwhelmingly likeliest to hold
 * come first, then the rest of the mainstream, then the two code forges — which
 * between them cover the developers and are last because most readers are not
 * one.
 *
 * Deliberately cuts across the three routes, so a strong provider and a wholly
 * unchecked one sit side by side. What each is worth is said the moment one is
 * picked, and never in the row itself.
 *
 * Anything missing from this list falls to the end, in the order the server sent
 * it — so a provider added later is merely last, not lost.
 */
const POPULARITY: IdentityProvider[] = [
  'facebook', 'x', 'linkedin',
  'tiktok', 'twitch', 'bluesky', 'mastodon',
  'github', 'gitlab'
]

/** Every place a reader might be, in one row. */
const providerOptions = computed(() => {
  const rank = (id: IdentityProvider) => {
    const i = POPULARITY.indexOf(id)
    return i === -1 ? POPULARITY.length : i
  }
  return [...challengeProviders.value, ...lookupProviders.value, ...claimProviders.value]
    .sort((a, b) => rank(a.id) - rank(b.id))
})

/** Which of the three routes the chosen provider takes. */
const via = computed<'challenge' | 'lookup' | 'claim' | null>(() => {
  if (!chosen.value) return null
  if (challengeProviders.value.some(p => p.id === chosen.value)) return 'challenge'
  if (lookupProviders.value.some(p => p.id === chosen.value)) return 'lookup'
  if (claimProviders.value.some(p => p.id === chosen.value)) return 'claim'
  return null
})

/** The chosen provider's own entry. Challenge options carry no account hint. */
const chosenMeta = computed(() =>
  [...lookupProviders.value, ...claimProviders.value].find(p => p.id === chosen.value) ?? null)

// A challenge comes back through a full page load, so the session is read fresh
// on the way in. A lookup never leaves the page: the proof is sealed into the
// cookie by the endpoint, and nothing on the client knows until it is asked
// again. Without this the account is confirmed and the form stays locked.
const { refresh: refreshProof } = useIdentityProof()

// Switching provider invalidates whatever was typed for the previous one — a
// GitHub username is not a Mastodon address — so the field starts clean.
watch(chosen, () => {
  account.value = ''
  error.value = ''
})

async function confirm() {
  if (!chosenMeta.value || !account.value.trim() || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const { identity } = await $fetch<{ identity: RequesterIdentity }>(
      via.value === 'claim' ? '/api/verify/claim' : '/api/verify/lookup',
      { method: 'POST', body: { provider: chosen.value, account: account.value } }
    )
    await refreshProof()
    emit('confirmed', identity)
    // Cleared rather than left showing what was just attached: the caller lists
    // the accounts in hand, and a picker still holding the last one would invite
    // the reader to attach it twice.
    chosen.value = undefined
    account.value = ''
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'We could not check that account. Please try again.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-if="!adding"
      class="flex items-start gap-3 rounded-lg bg-elevated/50 p-4"
    >
      <UIcon
        name="i-lucide-shield-check"
        class="mt-0.5 size-5 shrink-0 text-primary"
      />
      <div class="space-y-1 text-sm">
        <p class="font-medium text-highlighted">
          Show that a public account stands behind this
        </p>
        <p class="text-muted">
          A sponsor is a stranger paying for your books out of their own pocket. A public
          account beside your request lets them see who they're giving to.
          {{ allowance }}
        </p>
        <p class="text-muted">
          Your name, photo and profile link appear on the board. Your address, email and
          phone number never do.
        </p>
      </div>
    </div>

    <div
      v-if="anyProvider"
      class="flex flex-col gap-3"
    >
      <!--
        All of them on screen at once. A reader recognises their own logo far
        faster than they read a list of names, and neither happens at all behind
        a closed dropdown — which asked them to open something before it would
        admit whether it had what they were looking for.
      -->
      <div class="flex flex-col gap-2">
        <!--
          Asks what the reader is attaching, not where they live. The old
          wording — "which social media are you on?" — read as a question about
          them rather than about the request, which is both more intrusive than
          anything we do with the answer and less clear about why it is being
          asked at all. Singular, because a request carries one account: see the
          note on IdentityProof.
        -->
        <p class="text-sm font-medium text-highlighted">
          {{ adding
            ? 'Attach another profile?'
            : 'What social media profiles would you like to attach to this request?' }}
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="provider in providerOptions"
            :key="provider.id"
            :icon="provider.icon"
            :label="provider.label"
            color="neutral"
            variant="subtle"
            size="sm"
            :disabled="busy"
            :class="chosen === provider.id ? 'ring-2 ring-primary' : ''"
            :ui="{ leadingIcon: BRAND[provider.id] }"
            :aria-pressed="chosen === provider.id"
            @click="chosen = provider.id"
          />
        </div>
      </div>

      <!--
        Signing in is a round trip, so it gets a link where the other two get a
        field: there is nothing for the reader to type, and offering a box would
        only invite them to type the account they are about to be asked for
        anyway.
      -->
      <UButton
        v-if="via === 'challenge'"
        :to="challengeUrl(chosen!)"
        external
        :icon="providerOptions.find(p => p.id === chosen)?.icon"
        :label="`Sign in with ${providerLabel(chosen!)}`"
        color="neutral"
        variant="subtle"
        size="lg"
        :ui="{ leadingIcon: BRAND[chosen!] }"
        block
      />

      <UFormField
        v-else-if="chosenMeta"
        :label="`Your ${chosenMeta.label} ${chosenMeta.accountHint}`"
        :error="error || undefined"
      >
        <div class="flex gap-2">
          <UInput
            v-model="account"
            class="flex-1"
            :placeholder="chosenMeta.accountExample"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            :disabled="busy"
            autofocus
            @keydown.enter.prevent="confirm()"
          />
          <UButton
            :icon="via === 'claim' ? 'i-lucide-check' : 'i-lucide-user-search'"
            :label="via === 'claim' ? 'Use this' : 'Confirm'"
            color="neutral"
            :loading="busy"
            :disabled="!account.trim()"
            @click="confirm()"
          />
        </div>
        <template #help>
          Paste your profile link if that's easier.
        </template>
      </UFormField>

      <!--
        What this particular provider's route will and won't establish, said
        before anything is typed rather than only in the confirmation
        afterwards. This is the sentence the three-panel layout used to carry.
      -->
      <p
        v-if="via === 'challenge'"
        class="text-sm text-muted"
      >
        You'll go to {{ providerLabel(chosen!) }}, sign in, and come straight back. That
        proves the account is yours — the strongest thing any of these can show a sponsor.
        We never post anything.
      </p>
      <p
        v-else-if="via === 'lookup'"
        class="text-sm text-muted"
      >
        We'll fetch the profile to check it's really there. This shows a sponsor a real
        account — but it doesn't prove the account is yours, and your request will say so.
      </p>
      <p
        v-else-if="via === 'claim'"
        class="text-sm text-muted"
      >
        We can't check {{ providerLabel(chosen!) }} at all — not that the account is
        yours, not even that it exists — so your request will say plainly that you told us
        and we took your word for it. A sponsor can still open your profile and judge for
        themselves.
      </p>
      <p
        v-else
        class="text-sm text-muted"
      >
        Pick one and we'll tell you what we can check there. Some we can, some we can't,
        and your request will say which.
      </p>
    </div>

    <p
      v-else
      class="rounded-md bg-elevated/50 p-3 text-sm text-muted"
    >
      No way to verify an account is configured on this site yet, so requests can't be
      posted. Please
      <ULink
        to="/about"
        class="text-primary"
      >get in touch</ULink> and we'll sort it out.
    </p>

    <p class="text-xs text-dimmed">
      We read your public profile once and keep nothing beyond what you see above. You
      are not creating an account and there is no password. We never post anything, and
      we don't ask for your contacts or your friends.
    </p>
  </div>
</template>
