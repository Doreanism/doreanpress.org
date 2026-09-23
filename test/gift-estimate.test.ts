import { expect, it } from 'vitest'
import { estimateGift } from '../shared/giftEstimate'

it.each([[1, 941], [2, 1641], [3, 2341]])('budgets %i US copies including shipping and tax', (quantity, cents) => {
  expect(estimateGift([{ slug: 'the-doctrine-of-simony', quantity }], 941, 700, 'US')).toBe(cents)
})
it('does not apply US estimates to international requests', () => {
  expect(estimateGift([{ slug: 'the-doctrine-of-simony', quantity: 1 }], 941, 700, 'CA')).toBeNull()
})
it('does not invent a gift amount when pricing or the selection is missing', () => {
  expect(estimateGift([], 0, 0, 'US')).toBeNull()
  expect(estimateGift([], NaN, NaN, 'US')).toBeNull()
  expect(estimateGift([], 941, 700, 'US')).toBeNull()
})
