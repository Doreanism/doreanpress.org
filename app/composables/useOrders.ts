export function useOrders() {
  const { signedIn } = useSignedIn()
  const request = useRequestFetch()
  return useAsyncData('orders', () => signedIn.value
    ? request('/api/orders')
    : Promise.resolve(null), { watch: [signedIn] })
}
