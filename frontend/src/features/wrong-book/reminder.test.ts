import { describe, expect, it } from 'vitest'
import { shouldShowDailyReminder } from './reminder'

describe('daily wrong-book reminder', () => {
  it('does not show when nothing is due', () => {
    expect(shouldShowDailyReminder(0, null, '2026-09-16')).toBe(false)
  })

  it('shows once when cards are due', () => {
    expect(shouldShowDailyReminder(3, null, '2026-09-16')).toBe(true)
    expect(shouldShowDailyReminder(3, '2026-09-16', '2026-09-16')).toBe(false)
  })

  it('shows again on the next day while cards remain due', () => {
    expect(shouldShowDailyReminder(2, '2026-09-16', '2026-09-17')).toBe(true)
  })
})
