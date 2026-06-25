import Stripe from 'stripe'

let client: Stripe | null = null

export function useStripe(): Stripe {
  const key = useRuntimeConfig().stripeSecretKey
  if (!key) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Stripe is not configured. Set NUXT_STRIPE_SECRET_KEY.'
    })
  }
  if (!client) {
    client = new Stripe(key, { typescript: true })
  }
  return client
}
