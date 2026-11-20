import { expect, test } from '@playwright/test'
import { parseAutocompleteLimit } from '@/lib/search-limit'

test('autocomplete uses the existing default and maximum limit', () => {
  expect(parseAutocompleteLimit(null)).toBe(6)
  expect(parseAutocompleteLimit('1')).toBe(1)
  expect(parseAutocompleteLimit('6')).toBe(6)
  expect(parseAutocompleteLimit('20')).toBe(20)
  expect(parseAutocompleteLimit('21')).toBe(20)
  expect(parseAutocompleteLimit('200')).toBe(20)
})

test('autocomplete rejects values that could send NaN or invalid limits to PostgreSQL', () => {
  for (const value of ['', 'abc', 'NaN', 'Infinity', '-1', '0', '1.5', '1e3', '0x10', ' 7 ', '999999999999999999999']) {
    expect(parseAutocompleteLimit(value), value).toBeNull()
  }
})
