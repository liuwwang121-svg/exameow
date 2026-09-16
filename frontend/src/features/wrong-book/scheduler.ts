import type { ReviewRating, ReviewState } from './model'

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000

export function createInitialReviewState(now = Date.now()): ReviewState {
  return {
    due: now,
    stability: 0,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 'new',
    lastReview: null,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function roundDays(value: number): number {
  return Math.max(1, Math.round(value))
}

export function scheduleReview(current: ReviewState, rating: ReviewRating, now = Date.now()): ReviewState {
  const isNew = current.reps === 0
  const elapsedDays = current.lastReview === null
    ? 0
    : Math.max(0, Math.round((now - current.lastReview) / DAY_MS))

  let delayMs: number
  let scheduledDays: number
  let stability: number
  let difficultyDelta: number

  if (isNew) {
    const initial = {
      again: { delayMs: 10 * MINUTE_MS, stability: 0.1, difficultyDelta: 1 },
      hard: { delayMs: DAY_MS, stability: 1, difficultyDelta: 0.5 },
      good: { delayMs: 3 * DAY_MS, stability: 3, difficultyDelta: -0.2 },
      easy: { delayMs: 7 * DAY_MS, stability: 7, difficultyDelta: -1 },
    }[rating]
    delayMs = initial.delayMs
    stability = initial.stability
    difficultyDelta = initial.difficultyDelta
    scheduledDays = delayMs / DAY_MS
  } else if (rating === 'again') {
    delayMs = 10 * MINUTE_MS
    scheduledDays = delayMs / DAY_MS
    stability = Math.max(0.1, current.stability * 0.2)
    difficultyDelta = 1
  } else {
    const factor = rating === 'hard' ? 1.2 : rating === 'good' ? 2 : 3.5
    const minimumDays = rating === 'easy' ? 2 : 1
    scheduledDays = Math.max(minimumDays, roundDays(Math.max(1, current.stability) * factor))
    delayMs = scheduledDays * DAY_MS
    stability = scheduledDays
    difficultyDelta = rating === 'hard' ? 0.5 : rating === 'good' ? -0.2 : -1
  }

  return {
    due: now + delayMs,
    stability,
    difficulty: clamp(current.difficulty + difficultyDelta, 1, 10),
    elapsedDays,
    scheduledDays,
    reps: current.reps + 1,
    lapses: current.lapses + (rating === 'again' ? 1 : 0),
    state: rating === 'again' ? (isNew ? 'learning' : 'relearning') : 'review',
    lastReview: now,
  }
}
