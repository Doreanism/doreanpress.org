<script setup lang="ts">
// The top right corner, beside the cart.
//
// Signed in, it is one menu: what is yours — orders, the accounts standing
// behind your requests, signing out — and how this browser draws the site.
//
// Signed out, it is two plain buttons instead: a light/dark toggle and Sign in.
// A menu whose only real contents for a stranger are an appearance setting and
// a way in is a menu hiding two buttons, so they are shown as buttons. Your
// orders and Social profiles are not lost by this — both sit behind signing
// in, which is where the Sign in button leads.
//
// The switch between the two shapes also says who is there, which is why the
// person icon no longer carries a chip: a person in the corner now only ever
// means somebody is signed in.

const { signedIn, known, signOut } = useSignedIn()
const route = useRoute()
const { identities } = useIdentityProof()
const request = useRequestFetch()
const [
  { data: gifts, refresh: refreshGifts },
  { data: orders, refresh: refreshOrders },
  { data: admin, refresh: refreshAdmin }
] = await Promise.all([
  useGifts(),
  useOrders(),
  useAsyncData('administrator', async () => {
    if (!signedIn.value) return null
    return await request('/api/admin/me').catch(() => null)
  }, { watch: [signedIn] })
])
const open = ref(false)
watch(open, (isOpen) => {
  if (isOpen && signedIn.value) void Promise.all([refreshGifts(), refreshOrders(), refreshAdmin()])
})
const loginOpen = ref(false)
watch(signedIn, (account) => {
  if (account) loginOpen.value = false
})

async function onSignOut() {
  open.value = false
  await signOut()
  await navigateTo('/')
}
</script>

<template>
  <!--
    Not yet known only on the prerendered `/`, until the client has asked.
    Drawing either shape there would be a guess, and the wrong guess flashes;
    an empty slot of the signed-out width is the least jarring thing to hold.
  -->
  <div
    v-if="!known"
    class="h-8 w-16"
    aria-hidden="true"
  />

  <template v-else-if="!signedIn">
    <!--
      Light and dark only; System remains in the signed-in menu. A toggle has
      two states to flip between, and one button cannot also offer a third.
    -->
    <UColorModeButton />

    <UModal
      v-model:open="loginOpen"
      title="Sign in to Dorean Press"
      description="Manage your orders, giving, and social profiles."
      :ui="{ content: 'max-w-lg', title: 'font-display text-xl' }"
    >
      <UButton
        icon="i-lucide-log-in"
        color="neutral"
        variant="ghost"
        aria-label="Sign in"
        title="Sign in"
        :class="{ invisible: route.path === '/account' || route.path === '/account/' }"
      />
      <template #body>
        <EmailSignIn @authenticated="loginOpen = false" />
      </template>
    </UModal>
  </template>

  <UPopover
    v-else
    v-model:open="open"
    modal
    :content="{ align: 'end' }"
  >
    <!--
      `modal` so the page underneath does not scroll while this is open.
      Without it a popover only repositions itself as the page moves away
      beneath it, which on a phone means a flick intended for the menu carries
      the whole page off instead.
    -->
    <!--
      The name says settings as well as account: this is the only way to reach
      System, and a reader who cannot see the icon has no other clue that
      appearance lives behind a person.
    -->
    <UButton
      icon="i-lucide-circle-user-round"
      color="neutral"
      variant="ghost"
      :aria-label="`Your account and settings — signed in as ${signedIn.label}`"
      :title="signedIn.label"
    />

    <template #content>
      <div class="w-60 p-1">
        <p class="truncate px-2 pt-1.5 pb-1 text-xs font-medium text-muted">
          {{ signedIn.label }}
        </p>

        <UButton
          to="/account"
          icon="i-lucide-circle-user-round"
          label="Your account"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          @click="open = false"
        />

        <UButton
          v-if="orders?.requested.length"
          to="/orders"
          icon="i-lucide-package"
          label="Your orders"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          @click="open = false"
        />

        <UButton
          v-if="gifts?.length"
          to="/gifts"
          icon="i-lucide-gift"
          label="Your gifts"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          @click="open = false"
        />

        <UButton
          to="/emails"
          icon="i-lucide-mail"
          label="Email addresses"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          @click="open = false"
        />

        <!--
          The count is the durable provider identities linked to this account.
          Its absence is useful too: no number means a request will ask the
          reader to attach a public profile first.
        -->
        <UButton
          to="/profiles"
          icon="i-lucide-at-sign"
          label="Social profiles"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          :ui="{ trailingIcon: 'ms-auto' }"
          @click="open = false"
        >
          <template
            v-if="identities.length"
            #trailing
          >
            <UBadge
              :label="String(identities.length)"
              size="sm"
              color="neutral"
              variant="subtle"
              class="ms-auto"
            />
          </template>
        </UButton>

        <section
          v-if="admin"
          aria-label="Admin"
        >
          <USeparator class="my-1" />
          <p class="px-2 pt-1.5 pb-1 text-xs font-medium text-muted">
            Admin
          </p>
          <UButton
            to="/admin/fulfillment"
            label="Order fulfillment"
            icon="i-lucide-clipboard-list"
            color="neutral"
            variant="ghost"
            block
            class="justify-start"
            @click="open = false"
          />
        </section>

        <USeparator class="my-1" />

        <!--
          The site rather than you, which is why it is fenced off by rules
          rather than folded in with the orders above it.
        -->
        <AppAppearance />

        <USeparator class="my-1" />

        <UButton
          icon="i-lucide-log-out"
          label="Sign out"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          @click="onSignOut"
        />
      </div>
    </template>
  </UPopover>
</template>
