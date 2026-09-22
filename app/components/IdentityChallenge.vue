<script setup lang="ts">
// Puts a public account behind a request, by signing into it.
//
// The reader goes to a provider they already have an account with, that provider
// tells us who they are, and the identity becomes a durable sign-in method for
// their Dorean Press account.
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
// drawn as one: no providers, no requests — but only once the list has actually
// arrived, which is a third state and not the same as empty.

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
}>(), { adding: false })

const route = useRoute()

// `lazy`, so this never holds a page hostage.
//
// Awaited, this made the component's setup async, and an async component
// suspends the whole page it sits on: arriving at Public accounts by a
// client-side navigation left the *previous* page on screen — menu already
// shut, nothing moving — until this request landed. On the server it still
// resolves before the HTML is written (`onServerPrefetch` awaits it either
// way), so a page loaded directly is complete on arrival, as it was.
//
// No `default`. During hydration Nuxt takes any defined `data` as the server's
// payload and skips the fetch, marking it a success — and this component does
// mount mid-hydration: the request modal opens itself on `/cart?request=1`, the
// page every provider hands the reader back to, once the cart is read from
// storage. A default there was reported as the answer — an empty list — and the
// reader was told no provider exists, with nothing to attach a second one by.
const { data: providers, status } = useFetch<{ challenge: ChallengeOption[] }>(
  '/api/verify/providers',
  { lazy: true }
)
const challengeOptions = computed(() => providers.value?.challenge ?? [])

const anyProvider = computed(() => challengeOptions.value.length > 0)

/**
 * The services already spoken for, so the row can say so.
 *
 * A check means at least one identity from that provider is already linked.
 * The button stays live because readers may attach multiple accounts from the
 * same service; authenticating one already present simply refreshes its data.
 */
const { signedIn } = useSignedIn()
const { identities } = useIdentityProof()
const attachedCount = (id: IdentityProvider) => identities.value.filter(i => i.provider === id).length
const isAttached = (id: IdentityProvider) => attachedCount(id) > 0

/** Said on the button itself, where the consequence of pressing it is decided. */
const attachedHint = (id: IdentityProvider, label: string) => {
  const count = attachedCount(id)
  return `${count} ${label} ${count === 1 ? 'profile' : 'profiles'} attached. You may attach another.`
}

/**
 * Whether the list has actually arrived, which is a different question from
 * whether it has anything in it.
 *
 * An empty `challenge` means two opposite things at two different moments: not
 * yet, and never. Reading the first as the second tells a reader that requests
 * can't be posted on this site — the gravest sentence on the page — for as long
 * as one fetch takes, every time they arrive without a server render. So the
 * sentence waits until there is an answer to report.
 *
 * `error` counts as settled: a list that failed to arrive is not going to, and
 * a reader is better told the buttons aren't coming than left watching a
 * placeholder that resolves into nothing.
 */
const settled = computed(() => status.value === 'success' || status.value === 'error')

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
  return [...challengeOptions.value].sort((a, b) => rank(a.id) - rank(b.id))
})
</script>

<template>
  <EmailSignIn v-if="!signedIn?.email" />
  <template v-else>
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
            Your profile appears with your request
          </p>
          <p class="text-muted">
            Sponsors will see your name, photo and public profile link alongside your message.
          </p>
          <p class="text-muted">
            Your email stays private.
          </p>
        </div>
      </div>

      <!--
      The list is still coming. Only reachable on a client-side navigation —
      a page rendered on the server has the answer before it has any HTML.

      The question is asked now rather than withheld, because it is the same
      question whatever the answer turns out to be, and standing chips hold the
      row at its real height so nothing below it moves when the logos land.
    -->
      <div
        v-if="!settled"
        class="flex flex-col gap-2"
      >
        <p class="text-sm font-medium text-highlighted">
          {{ adding
            ? 'Attach another account'
            : 'Choose an account to attach' }}
        </p>
        <!--
        One row, never two. How many providers are coming is not known until
        they arrive, so the count here is a guess — and a guess that wraps onto
        three lines on a phone and then collapses to one drags the whole page
        up as it resolves, which is worse than holding too little space. So the
        chips do not wrap and the surplus is clipped: whatever the answer, this
        occupies exactly the height of a single row of buttons.
      -->
        <div
          class="flex h-8 gap-2 overflow-hidden"
          aria-hidden="true"
        >
          <USkeleton
            v-for="n in 6"
            :key="n"
            class="h-8 w-24 shrink-0 rounded-md"
          />
        </div>
      </div>

      <div
        v-else-if="anyProvider"
        class="flex flex-col gap-3"
      >
        <div class="flex flex-col gap-2">
          <p class="text-sm font-medium text-highlighted">
            {{ adding
              ? 'Attach another account'
              : 'Choose an account to attach' }}
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
                :trailing-icon="isAttached(provider.id) ? 'i-lucide-check' : undefined"
                :title="isAttached(provider.id) ? attachedHint(provider.id, provider.label) : undefined"
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
                :trailing-icon="isAttached(provider.id) ? 'i-lucide-check' : undefined"
                :title="isAttached(provider.id) ? attachedHint(provider.id, provider.label) : undefined"
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
            Enter your Bluesky handle, then sign in to confirm it’s yours.
          </template>
        </UFormField>

        <p class="text-sm text-muted">
          Sign in with your provider to confirm the account is yours. You’ll return here afterward.
          We won’t post on your behalf.
        </p>
      </div>

      <!--
      Settled, and empty. The tail of a three-way chain rather than a plain
      `v-else` on `anyProvider`, because "we haven't asked yet" must never be
      drawn as "this site can take no requests".
    -->
      <p
        v-else
        class="rounded-md bg-elevated/50 p-3 text-sm text-muted"
      >
        Account attachment is currently unavailable. Please
        <ULink
          to="/#about"
          class="text-primary"
        >contact us</ULink> for help requesting a book.
      </p>

      <p class="text-xs text-dimmed">
        This profile is saved to your Dorean Press account. You can use it to sign in again.
      </p>
    </div>
  </template>
</template>
