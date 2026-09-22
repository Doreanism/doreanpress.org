export function useGifts() {
  const { signedIn } = useSignedIn()
  const request = useRequestFetch()
  return useAsyncData('gifts', () => signedIn.value
    ? request('/api/gifts')
    : Promise.resolve(null), { watch: [signedIn] })
}
