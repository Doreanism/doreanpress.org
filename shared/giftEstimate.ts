import { itemsCopies, type RequestItem } from './catalog'

/** Budget estimate in USD cents, based on the books actually reserved. */
export function estimateGift(items: RequestItem[], firstCopyCents: number, additionalCopyCents: number, country: string): number | null {
  if (country.trim().toUpperCase() !== 'US' || itemsCopies(items) < 1) return null
  if (!Number.isSafeInteger(firstCopyCents) || firstCopyCents <= 0
    || !Number.isSafeInteger(additionalCopyCents) || additionalCopyCents < 0) return null
  const total = firstCopyCents + (itemsCopies(items) - 1) * additionalCopyCents
  return Number.isSafeInteger(total) && total > 0 ? total : null
}
