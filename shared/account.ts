export interface SignedIn {
  accountId: string
  /** Current primary email; legacy provider-only accounts may not have one. */
  email?: string
  /** What the account menu can show when there is no email address. */
  label: string
  at: string
}
