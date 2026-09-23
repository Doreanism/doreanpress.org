// Gift request codes are copied by hand into Zeffy's checkout question,
// so they use Crockford base32: no I, L, O, or U, and case-insensitive. Eight
// characters carry 40 random bits, which is plenty for codes that matter only
// while a reservation lasts; the primary key still rejects a repeat.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const PREFIX = 'DP'

export function newGiftCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  const chars = Array.from(bytes, byte => ALPHABET[byte & 31]).join('')
  return `${PREFIX}-${chars.slice(0, 4)}-${chars.slice(4)}`
}

// Accept what a donor is likely to type: any case, missing or extra dashes and
// spaces, no prefix, and O/I/L for 0/1. Anything else, including a reservation
// made before these codes existed (a UUID), passes through trimmed.
export function normalizeGiftCode(input: string) {
  const trimmed = input.trim()
  const compact = trimmed.toUpperCase().replace(/[\s_-]/g, '')
    .replace(new RegExp(`^${PREFIX}`), '')
    .replace(/O/g, '0').replace(/[IL]/g, '1')
  if (compact.length !== 8 || [...compact].some(c => !ALPHABET.includes(c))) return trimmed
  return `${PREFIX}-${compact.slice(0, 4)}-${compact.slice(4)}`
}
