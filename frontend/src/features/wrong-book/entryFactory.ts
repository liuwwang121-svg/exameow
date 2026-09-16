import type { Question } from '@exameow/shared'
import { WRONG_BOOK_SCHEMA_VERSION, type WrongBookEntry } from './model'
import { createInitialReviewState } from './scheduler'

export interface PracticeWrongInput {
  bankId: string
  bankName: string
  question: Question
  userAnswer: string
}

function compactStem(stem: string): string {
  const normalized = stem.replace(/\s+/g, ' ').trim()
  return normalized.length > 34 ? `${normalized.slice(0, 34)}…` : normalized
}

export function createOrUpdatePracticeWrong(
  input: PracticeWrongInput,
  existing: WrongBookEntry | null,
  now = Date.now(),
  makeId: () => string = () => crypto.randomUUID(),
): WrongBookEntry {
  const sourceKey = `practice:${input.bankId}:${input.question.id}`
  if (existing) {
    return {
      ...existing,
      stem: input.question.stem,
      options: [...input.question.options],
      answer: input.question.answer,
      analysis: input.question.analysis,
      userAnswer: input.userAnswer,
      wrongCount: existing.wrongCount + 1,
      review: { ...existing.review, due: now },
      recordedAt: now,
      updatedAt: now,
    }
  }

  const title = `${input.bankName}｜${compactStem(input.question.stem)}`
  return {
    id: makeId(),
    schemaVersion: WRONG_BOOK_SCHEMA_VERSION,
    source: 'practice',
    sourceKey,
    title,
    recordedAt: now,
    subject: input.question.subject ?? '行测',
    section: input.question.chapter ?? '',
    stem: input.question.stem,
    options: [...input.question.options],
    answer: input.question.answer,
    analysis: input.question.analysis,
    userAnswer: input.userAnswer,
    notes: '',
    aiAnalysis: input.question.aiAnalysis ?? '',
    cause: '自定义',
    blocks: [{ kind: 'text', text: input.question.stem }],
    assetIds: [],
    wrongCount: 1,
    needsConfirmation: false,
    review: createInitialReviewState(now),
    createdAt: now,
    updatedAt: now,
  }
}
