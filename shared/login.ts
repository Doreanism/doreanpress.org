/** Only local navigation targets, never protocol-relative URLs or backslashes. */
export function loginReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\s]/.test(value) || /%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|20)/i.test(value)) return '/account'
  if (value.startsWith('//') || value.startsWith('/account/confirm')) return '/account'
  return value
}

/** Trust the actual port on loopback in development; production uses configuration. */
export function loginOrigin(requestUrl: string, siteUrl: string, development: boolean): string {
  const request = new URL(requestUrl)
  if (development && ['localhost', '127.0.0.1', '[::1]'].includes(request.hostname)) return request.origin
  const configured = new URL(siteUrl)
  if (!['http:', 'https:'].includes(configured.protocol)) throw new Error('Invalid site URL')
  return configured.origin
}
