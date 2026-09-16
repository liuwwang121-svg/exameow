import { describe, expect, it } from 'vitest'
import { createInitialReviewState, scheduleReview } from './scheduler'

const NOW = Date.UTC(2026, 8, 16, 8, 0, 0)
const MINUTE = 60_000
const DAY = 86_400_000

describe('wrong-book scheduler', () => {
  it.each([
    ['again', 10 * MINUTE],
    ['hard', DAY],
    ['good', 3 * DAY],
    ['easy', 7 * DAY],
  ] as const)('schedules a new card rated %s', (rating, expectedDelay) => {
    const next = scheduleReview(createInitialReviewState(NOW), rating, NOW)

    expect(next.due).toBe(NOW + expectedDelay)
    expect(next.reps).toBe(1)
    expect(next.scheduledDays).toBeCloseTo(expectedDelay / DAY)
  })

  it('moves a forgotten review into relearning and increments lapses', () => {
    const prior = {
      ...createInitialReviewState(NOW - 10 * DAY),
      due: NOW - DAY,
      stability: 8,
      reps: 3,
      state: 'review' as const,
      lastReview: NOW - 4 * DAY,
    }

    const next = scheduleReview(prior, 'again', NOW)

    expect(next.state).toBe('relearning')
    expect(next.lapses).toBe(1)
    expect(next.due).toBe(NOW + 10 * MINUTE)
    expect(next.elapsedDays).toBe(4)
  })

  it('grows the interval for a successful mature review', () => {
    const prior = {
      ...createInitialReviewState(NOW - 20 * DAY),
      due: NOW,
      stability: 6,
      difficulty: 5,
      reps: 4,
      state: 'review' as const,
      lastReview: NOW - 6 * DAY,
    }

    const good = scheduleReview(prior, 'good', NOW)
    const easy = scheduleReview(prior, 'easy', NOW)

    expect(good.scheduledDays).toBe(12)
    expect(easy.scheduledDays).toBe(21)
    expect(easy.difficulty).toBeLessThan(good.difficulty)
  })

  it('keeps difficulty inside the 1 to 10 range', () => {
    const hard = scheduleReview({ ...createInitialReviewState(NOW), difficulty: 10 }, 'again', NOW)
    const easy = scheduleReview({ ...createInitialReviewState(NOW), difficulty: 1 }, 'easy', NOW)

    expect(hard.difficulty).toBe(10)
    expect(easy.difficulty).toBe(1)
  })
})
