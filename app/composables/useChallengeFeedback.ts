import { providerLabel, type IdentityProvider } from '#shared/identity'

/**
 * Turns the `?verifyError=<provider>` flag the challenge routes redirect with
 * into a toast, then strips it so a reload doesn't show it twice.
 *
 * The routes pass a bare provider name rather than a message on purpose:
 * provider errors quote client ids and internal URLs, so they're logged on the
 * server and never sent to the browser.
 */
export function useChallengeFeedback() {
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()

  onMounted(() => {
    const failed = route.query.verifyError
    if (!failed) return

    toast.add({
      title: `Could not verify with ${providerLabel(String(failed) as IdentityProvider)}`,
      description: 'Nothing was saved. Please try again, or use a different account.',
      icon: 'i-lucide-triangle-alert',
      color: 'error'
    })

    const query = { ...route.query }
    delete query.verifyError
    router.replace({ query })
  })
}
