<script setup lang="ts">
import { formatPrice } from '#shared/catalog'

// Orders, and the sign-in that has to happen first.
//
// One page rather than two. Signing in is not a destination — nobody wants to be
// signed in, they want to see where their books are — so the form is what this
// page shows while it cannot answer that yet, and it is replaced by the answer
// rather than redirecting somewhere else.

const { signedIn, pending, requestCode, verifyCode, signOut } = useSignedIn()
const toast = useToast()

const email = ref('')
const code = ref('')
/** Which half of the sign-in we are on: ask for a code, then hand it back. */
const sent = ref(false)
const error = ref('')

interface OrderLine {
  id: string
  titles: string[]
  status?: string
  shippingStatus?: string
  trackingUrl?: string
  amountCents?: number
  currency?: string
  createdAt: string
  requesters?: unknown[]
}

// Same reason as in `useSignedIn`: on the server a bare `$fetch` carries no
// cookies, so `/api/orders` would answer 401 during SSR and the page would
// render empty before the client fetched it again properly.
const request = useRequestFetch()

const { data: orders, refresh: refreshOrders } = await useAsyncData(
  'orders',
  () => signedIn.value
    ? request<{
        email: string
        requested: OrderLine[]
        sponsored: OrderLine[]
        purchased: OrderLine[]
      }>('/api/orders')
    : Promise.resolve(null),
  { watch: [signedIn] }
)

async function onRequestCode() {
  error.value = ''
  if (!email.value.includes('@')) {
    error.value = 'Please enter an email address.'
    return
  }
  try {
    await requestCode(email.value)
    sent.value = true
    // Says "if" rather than "we sent", because the honest version of this
    // message cannot promise the address is one we know — see the endpoint.
    toast.add({
      title: 'Check your email',
      description: `If ${email.value} has orders here, a sign-in code is on its way.`,
      icon: 'i-lucide-mail',
      color: 'primary'
    })
  } catch {
    error.value = 'Could not send a code just now. Please try again.'
  }
}

async function onVerify() {
  error.value = ''
  try {
    await verifyCode(email.value, code.value)
    code.value = ''
    sent.value = false
    await refreshOrders()
  } catch (err) {
    error.value = (err as { data?: { statusMessage?: string } })?.data?.statusMessage
      || 'That code is not right.'
  }
}

async function onSignOut() {
  await signOut()
  orders.value = null
  sent.value = false
  email.value = ''
}

/** Plain English for Lulu's status names, which are not written for readers. */
function shippingLabel(line: OrderLine): string {
  if (line.trackingUrl || line.shippingStatus === 'SHIPPED') return 'Shipped'
  if (line.shippingStatus === 'IN_PRODUCTION') return 'Being printed'
  if (line.shippingStatus === 'REJECTED' || line.shippingStatus === 'CANCELED') return 'Stopped'
  if (line.status === 'fulfilled' || line.shippingStatus) return 'Paid, being prepared'
  return 'Waiting for a giver'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
</script>

<template>
  <UContainer class="py-12 sm:py-16">
    <UPageHeader
      :ui="{ title: 'font-display' }"
      title="Orders"
      :description="signedIn
        ? `Everything ${signedIn.email} is waiting for, has given, or has bought.`
        : 'Sign in with your email to see the books coming to you and the ones you have given.'"
    />

    <!-- Signed out: ask for an address, then for the code that lands in it. -->
    <div
      v-if="!signedIn"
      class="mt-10 max-w-md"
    >
      <form
        class="flex flex-col gap-3"
        @submit.prevent="sent ? onVerify() : onRequestCode()"
      >
        <UFormField
          label="Email address"
          :error="error || undefined"
        >
          <UInput
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            :disabled="sent"
            class="w-full"
          />
        </UFormField>

        <UFormField
          v-if="sent"
          label="Six-digit code"
          description="It works once, for ten minutes."
        >
          <UInput
            v-model="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="123456"
            class="w-full"
          />
        </UFormField>

        <div class="flex items-center gap-2">
          <UButton
            type="submit"
            :label="sent ? 'Sign in' : 'Email me a code'"
            :loading="pending"
            icon="i-lucide-mail"
          />
          <UButton
            v-if="sent"
            label="Use a different address"
            color="neutral"
            variant="ghost"
            @click="sent = false; code = ''; error = ''"
          />
        </div>
      </form>

      <p class="mt-6 text-sm text-muted">
        Signing in shows you your own orders. Asking for a free book is separate —
        that still means attaching a public account, so a giver can see who they
        are giving to.
      </p>
    </div>

    <!-- Signed in: the three groups. -->
    <div
      v-else
      class="mt-10 flex flex-col gap-10"
    >
      <section
        v-for="group in [
          { key: 'requested', title: 'Coming to you', empty: 'You have not asked for any books yet.', rows: orders?.requested ?? [] },
          { key: 'purchased', title: 'Bought by you', empty: 'You have not bought anything from the catalog yet.', rows: orders?.purchased ?? [] },
          { key: 'sponsored', title: 'Given by you', empty: 'You have not sponsored anyone yet — the board is at Give a Book.', rows: orders?.sponsored ?? [] }
        ]"
        :key="group.key"
        class="flex flex-col gap-3"
      >
        <h2 class="font-display text-xl font-semibold text-highlighted">
          {{ group.title }}
        </h2>

        <p
          v-if="group.rows.length === 0"
          class="text-sm text-muted"
        >
          {{ group.empty }}
        </p>

        <div
          v-for="line in group.rows"
          v-else
          :key="line.id"
          class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg ring ring-default bg-default p-4"
        >
          <div class="min-w-0">
            <p class="font-display font-semibold text-highlighted">
              {{ line.titles.join(', ') || 'Books no longer in the catalog' }}
            </p>
            <p class="text-sm text-muted">
              {{ formatDate(line.createdAt) }}
              <span v-if="line.amountCents != null">
                · {{ formatPrice(line.amountCents, line.currency) }}
              </span>
            </p>
          </div>

          <div class="flex items-center gap-3">
            <UBadge
              :label="shippingLabel(line)"
              color="neutral"
              variant="subtle"
            />
            <UButton
              v-if="line.trackingUrl"
              :to="line.trackingUrl"
              external
              target="_blank"
              label="Track"
              icon="i-lucide-truck"
              color="neutral"
              variant="link"
              size="xs"
            />
          </div>
        </div>
      </section>

      <div>
        <UButton
          label="Sign out"
          icon="i-lucide-log-out"
          color="neutral"
          variant="subtle"
          size="sm"
          @click="onSignOut"
        />
      </div>
    </div>
  </UContainer>
</template>
