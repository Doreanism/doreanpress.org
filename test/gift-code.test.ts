import { expect, it } from 'vitest'
import { newGiftCode, normalizeGiftCode } from '../shared/giftCode'

it('makes short codes without ambiguous letters', () => {
  for (let i = 0; i < 200; i++) expect(newGiftCode()).toMatch(/^DP-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/)
})

it('reads codes the way donors are likely to type them', () => {
  for (const typed of ['DP-7K3M-Q9XA', 'dp-7k3m-q9xa', ' dp 7k3m q9xa ', '7K3MQ9XA', 'DP7K3M-Q9XA']) {
    expect(normalizeGiftCode(typed)).toBe('DP-7K3M-Q9XA')
  }
  expect(normalizeGiftCode('dp-1o1l-i000')).toBe('DP-1011-1000')
})

it('passes older and unrecognized answers through trimmed', () => {
  const uuid = '854d41de-9fd5-4b0a-82fe-87323764f3ff'
  expect(normalizeGiftCode(` ${uuid} `)).toBe(uuid)
  expect(normalizeGiftCode('for the church library')).toBe('for the church library')
})
