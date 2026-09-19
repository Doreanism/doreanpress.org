export interface SignedIn {
  accountId: string
  /** Email when the account has one; provider-only accounts need not. */
  email?: string
  /** What the account menu can show when there is no email address. */
  label: string
  at: string
}
