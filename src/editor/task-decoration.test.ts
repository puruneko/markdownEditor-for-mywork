import { describe, it, expect } from 'vitest'
import { findListArrow } from './task-decoration'

describe('findListArrow', () => {
  it.each([
    ['- → a', { from: 2, to: 3 }],
    ['- -> a', { from: 2, to: 4 }],
    ['1. -> a', { from: 3, to: 5 }],
    ['- [ ] -> a', { from: 6, to: 8 }],
  ])('%s', (line, expected) => {
    expect(findListArrow(line)).toEqual(expected)
  })
  it.each(['- [>] a', '- a -> b', '- @memo: -> x', '-> a'])('対象外: %s', (line) => {
    expect(findListArrow(line)).toBeNull()
  })
})
