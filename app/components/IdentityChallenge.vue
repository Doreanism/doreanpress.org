<script setup lang="ts">
// Puts a public account behind a request, by whichever of three routes the
// reader has one for.
//
// Not a login. There is no account to create, no password, and nothing is
// remembered afterwards — the copy below is careful not to imply otherwise.
//
// One picker, not three panels. A reader knows which social media they are on
// long before they know which of our three checks it happens to support, so the
// question asked first is theirs — "where can we find you?" — and the route
// follows from the answer.
//
// What must survive that merge is the thing the three routes differ on. Signing
// in proves the account is the reader's. Naming one for us to read only proves
// it is there. Telling us about one proves nothing whatever. The list itself
// stays out of that argument — it is ordered strongest first and otherwise just
// names places — and the promise for the chosen provider is spelled out under
// the field the moment one is picked, before anything is typed. It is never
// left to be inferred from a missing tick, because a sponsor is about to spend
// money on the difference.
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

const props = defineProps<{
  /** Where to land once the challenge passes. Defaults to the page we're on. */
  redirect?: string
}>()

const emit = defineEmits<{ confirmed: [RequesterIdentity] }>()

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
//
// `undefined` rather than `null` for the empty case: `USelect` treats null as a
// value to render rather than as nothing chosen.
const chosen = ref<IdentityProvider | undefined>()
const account = ref('')
const busy = ref(false)
const error = ref('')
const result = ref<RequesterIdentity | null>(null)

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
  gitlab: 'text-[#FC6D26]',
  codeberg: 'text-[#2185D0] dark:text-[#4AA3E8]',
  stackoverflow: 'text-[#F48024]'
}

/**
 * The select's options: one plain list of places a reader might be, in order of
 * what we can establish there — sign-in first, then the ones we can read, then
 * the ones we can only be told about.
 *
 * Deliberately unheaded. The reader is answering "where am I?", which they know
 * the answer to before they know anything about our checks, and sorting the
 * logos under verdicts made the list argue with them mid-question. What each
 * choice is worth is said in full the moment one is made — see the sentence
 * under the field, the card after confirming, and the board itself — so nothing
 * about the weaker routes goes unsaid, it is simply said once the question it
 * answers has been asked.
 */
const providerChoices = computed(() =>
  [...challengeProviders.value, ...lookupProviders.value, ...claimProviders.value]
    .map(p => ({
      label: p.label,
      value: p.id,
      icon: p.icon,
      ui: { itemLeadingIcon: BRAND[p.id] }
    })))

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

/**
 * The chosen provider's logo, for the closed trigger. Nuxt UI's own trigger
 * shows the label alone, which leaves the one row a reader looks at longest as
 * the only one without its mark.
 *
 * Fed to the `icon` prop rather than the `leading` slot: the slot's wrapper is
 * absolutely positioned, and only the prop makes the trigger reserve the space
 * for it — through the slot the logo sits on top of its own label.
 */
const chosenIcon = computed(() => {
  const all = [...challengeProviders.value, ...lookupProviders.value, ...claimProviders.value]
  const entry = all.find(p => p.id === chosen.value)
  return entry ? { name: entry.icon, class: BRAND[entry.id] } : null
})

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
  result.value = null
})

async function confirm() {
  if (!chosenMeta.value || !account.value.trim() || busy.value) return
  busy.value = true
  error.value = ''
  result.value = null
  try {
    const { identity } = await $fetch<{ identity: RequesterIdentity }>(
      via.value === 'claim' ? '/api/verify/claim' : '/api/verify/lookup',
      { method: 'POST', body: { provider: chosen.value, account: account.value } }
    )
    result.value = identity
    await refreshProof()
    emit('confirmed', identity)
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'We could not check that account. Please try again.'
  } finally {
    busy.value = false
  }
}

function accountAge(iso?: string) {
  if (!iso) return ''
  const opened = new Date(iso)
  if (Number.isNaN(opened.getTime())) return ''
  return opened.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-start gap-3 rounded-lg bg-elevated/50 p-4">
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
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start">
        <UFormField
          label="Which social media?"
          class="sm:w-56"
        >
          <!--
            Taller than the default popup, which cuts off at six rows and so
            hides five of the eleven providers behind a scroll. A reader on
            Facebook should not have to go looking for it.
          -->
          <USelect
            v-model="chosen"
            :items="providerChoices"
            value-key="value"
            placeholder="Choose one"
            class="w-full"
            :disabled="busy"
            :icon="chosenIcon?.name"
            :ui="{ content: 'max-h-96', leadingIcon: chosenIcon?.class }"
          />
        </UFormField>

        <!--
          Signing in is a round trip, so it gets a link where the other two get a
          field: there is nothing for the reader to type, and offering a box
          beside it would only invite them to type the account they are about to
          be asked for anyway.
        -->
        <UFormField
          v-if="via === 'challenge'"
          label="&nbsp;"
          class="flex-1"
        >
          <UButton
            :to="challengeUrl(chosen!)"
            external
            :icon="challengeProviders.find(p => p.id === chosen)?.icon"
            :label="`Sign in with ${providerLabel(chosen!)}`"
            color="neutral"
            variant="subtle"
            block
          />
        </UFormField>

        <UFormField
          v-else
          :label="chosenMeta ? `Your ${chosenMeta.label} ${chosenMeta.accountHint}` : 'Your username'"
          class="flex-1"
          :error="error || undefined"
        >
          <div class="flex gap-2">
            <UInput
              v-model="account"
              class="flex-1"
              :placeholder="chosenMeta?.accountExample || 'Pick a social media first'"
              autocapitalize="none"
              autocorrect="off"
              spellcheck="false"
              :disabled="!chosenMeta || busy"
              @keydown.enter.prevent="confirm()"
            />
            <UButton
              :icon="via === 'claim' ? 'i-lucide-check' : 'i-lucide-user-search'"
              :label="via === 'claim' ? 'Use this' : 'Confirm'"
              color="neutral"
              :loading="busy"
              :disabled="!chosenMeta || !account.trim()"
              @click="confirm()"
            />
          </div>
          <template #help>
            Paste your profile link if that's easier.
          </template>
        </UFormField>
      </div>

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
        Pick the social media you're on and we'll tell you what we can check there. Some
        we can, some we can't, and your request will say which.
      </p>

      <!--
        The result, drawn from what the server says was established rather than
        from which button was pressed. A claimed account gets no avatar and no
        tick, because a check is precisely the thing that did not happen — its
        icon is a plain speech mark instead.
      -->
      <div
        v-if="result"
        class="flex items-start gap-3 rounded-lg bg-elevated/50 p-3 ring ring-default"
      >
        <UIcon
          v-if="result.confirmation === 'claimed'"
          name="i-lucide-message-square-quote"
          class="mt-0.5 size-5 shrink-0 text-dimmed"
        />
        <UAvatar
          v-else
          :src="result.avatarUrl"
          :alt="result.name"
          size="md"
        />
        <div class="min-w-0 flex-1 space-y-1">
          <p class="flex items-center gap-1.5 text-sm font-medium text-highlighted">
            <UIcon
              v-if="result.confirmation !== 'claimed'"
              name="i-lucide-circle-check"
              class="size-4 shrink-0 text-primary"
            />
            <span class="truncate">
              {{ result.confirmation === 'claimed'
                ? `@${result.handle} on ${providerLabel(result.provider)}`
                : result.name }}
            </span>
          </p>
          <p
            v-if="result.confirmation !== 'claimed'"
            class="truncate text-xs text-dimmed"
          >
            {{ result.handle ? `@${result.handle}` : providerLabel(result.provider) }}
            <span v-if="accountAge(result.accountCreatedAt)">
              · on {{ providerLabel(result.provider) }} since {{ accountAge(result.accountCreatedAt) }}
            </span>
          </p>
          <p
            v-if="result.confirmation === 'claimed'"
            class="text-xs text-muted"
          >
            We've taken your word for this one. Your request will show it as told to us,
            not checked — and it will link to
            <ULink
              :to="result.profileUrl"
              external
              target="_blank"
              class="text-primary"
            >{{ result.profileUrl }}</ULink>
            so a sponsor can look for themselves. If that link is wrong, fix it now.
          </p>
          <p
            v-else
            class="text-xs text-muted"
          >
            This account exists and we read its public profile. We haven't checked that
            you're the person who holds it — your request will show it as named, not
            proved.
          </p>
        </div>
      </div>
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
