<script setup lang="ts">
// Puts a public account behind a request, by signing into it.
//
// Not a login here either — there is no account to create on this site, no
// password of ours, and nothing is remembered afterwards. The reader goes to a
// provider they already have an account with, that provider tells us who they
// are, and we keep the answer for twenty minutes.
//
// This used to offer three routes: sign in, or name an account for us to fetch,
// or simply tell us about one. The bottom two are gone. They asked a sponsor to
// pay real money on the strength of a handle anybody could type, and no amount
// of careful labelling around them changed what they actually established, which
// was nothing about the person asking. What is left is the only route that ever
// answered the sponsor's real question — is this the person I am about to pay
// for — so there is now one kind of button, one promise, and no rung to explain.
//
// One row of logos. A reader knows which social media they are on long before
// they know anything about how we check it, so the question asked is theirs —
// where can we find you? — and every answer is on screen at once.
//
// The provider list comes from the server rather than being hard-coded, so a
// deployment that has credentials for only some of them never shows a button
// that dead-ends on a configuration error. An empty list is a real state and is
// drawn as one: no providers, no requests.

import { providerLabel, type IdentityProvider } from '#shared/identity'

interface ChallengeOption {
  id: IdentityProvider
  label: string
  icon: string
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

const route = useRoute()
const { data: providers } = await useFetch<{ challenge: ChallengeOption[] }>(
  '/api/verify/providers',
  { default: () => ({ challenge: [] }) }
)

const anyProvider = computed(() => providers.value.challenge.length > 0)

/**
 * The invitation to attach more than one, with the ceiling named where there is
 * one. Said as an allowance rather than a restriction: the number is here to
 * tell a reader how much room they have, not to warn them off using it.
 */
const allowance = computed(() => props.limit
  ? `You can attach up to ${props.limit} profiles — several together say more than any one of them alone.`
  : 'You can attach more than one — several profiles together say more than any of them alone.')

function challengeUrl(provider: IdentityProvider, handle?: string) {
  const params = new URLSearchParams({ redirect: props.redirect || route.fullPath })
  if (handle) params.set('handle', handle)
  return `/verify/${provider}?${params}`
}

/**
 * Bluesky is the one provider that cannot be a single button, because atproto
 * is a network of servers rather than one: the handle is what says which server
 * holds the account, and so which one is being asked to sign the reader in.
 *
 * The field looks like the one the old lookup route had and means something
 * entirely different — nothing here believes what is typed. Type a handle that
 * is not yours and you arrive at that person's server needing that person's
 * password. The copy under the field says so, because the resemblance is exactly
 * the sort of thing a reader would otherwise draw the wrong conclusion from.
 */
const HANDLE_PROVIDER: IdentityProvider = 'bluesky'
const handleFor = ref<IdentityProvider | null>(null)
const handle = ref('')

function choose(provider: IdentityProvider) {
  if (provider !== HANDLE_PROVIDER) return
  handleFor.value = handleFor.value === provider ? null : provider
  handle.value = ''
}

function goToHandleProvider() {
  const typed = handle.value.trim().replace(/^@/, '')
  if (!typed) return
  return navigateTo(challengeUrl(HANDLE_PROVIDER, typed), { external: true })
}

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
  gitlab: 'text-[#FC6D26]',
  // Not a brand — a dev-only stand-in, coloured so it never reads as one of the
  // real buttons beside it. It cannot appear outside dev; see DEV_ONLY_PROVIDERS.
  youface: 'text-amber-500'
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
 * Anything missing from this list falls to the end, in the order the server sent
 * it — so a provider added later is merely last, not lost.
 */
const POPULARITY: IdentityProvider[] = [
  'facebook', 'x', 'linkedin',
  'tiktok', 'twitch', 'bluesky',
  'github', 'gitlab'
]

/** Every place a reader might be, in one row. */
const providerOptions = computed(() => {
  const rank = (id: IdentityProvider) => {
    const i = POPULARITY.indexOf(id)
    return i === -1 ? POPULARITY.length : i
  }
  return [...providers.value.challenge].sort((a, b) => rank(a.id) - rank(b.id))
})
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
      <div class="flex flex-col gap-2">
        <p class="text-sm font-medium text-highlighted">
          {{ adding
            ? 'Attach another profile?'
            : 'What social media profiles would you like to attach to this request?' }}
        </p>

        <!--
          Every provider is a link straight to its own sign-in, because every
          provider now does the same thing. The picker used to be two steps —
          choose, then read what that choice would establish, then act — which
          existed because the three routes established different things. With one
          route the sentence is the same for all of them, so it is said once
          above rather than n times behind a click.
        -->
        <div class="flex flex-wrap gap-2">
          <template
            v-for="provider in providerOptions"
            :key="provider.id"
          >
            <UButton
              v-if="provider.id === HANDLE_PROVIDER"
              :icon="provider.icon"
              :label="provider.label"
              color="neutral"
              variant="subtle"
              size="sm"
              :class="handleFor === provider.id ? 'ring-2 ring-primary' : ''"
              :ui="{ leadingIcon: BRAND[provider.id] }"
              :aria-pressed="handleFor === provider.id"
              @click="choose(provider.id)"
            />
            <UButton
              v-else
              :to="challengeUrl(provider.id)"
              external
              :icon="provider.icon"
              :label="provider.label"
              color="neutral"
              variant="subtle"
              size="sm"
              :ui="{ leadingIcon: BRAND[provider.id] }"
            />
          </template>
        </div>
      </div>

      <UFormField
        v-if="handleFor"
        :label="`Your ${providerLabel(handleFor)} handle`"
      >
        <div class="flex gap-2">
          <UInput
            v-model="handle"
            class="flex-1"
            placeholder="alice.bsky.social"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            autofocus
            @keydown.enter.prevent="goToHandleProvider()"
          />
          <UButton
            icon="i-lucide-external-link"
            label="Continue"
            color="neutral"
            :disabled="!handle.trim()"
            @click="goToHandleProvider()"
          />
        </div>
        <template #help>
          Bluesky is many servers, so your handle is how we find yours — you'll still sign
          in there. Typing someone else's gets you their sign-in page, not their account.
        </template>
      </UFormField>

      <p class="text-sm text-muted">
        You'll go to the provider, sign in, and come straight back. That proves the account
        is yours, which is the only thing we're willing to show a sponsor. We never post
        anything.
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
