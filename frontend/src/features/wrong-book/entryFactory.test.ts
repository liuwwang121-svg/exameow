import { describe, expect, it } from 'vitest'
import { QuestionType, type Question } from '@exameow/shared'
import { createOrUpdatePracticeWrong } from './entryFactory'

const NOW = Date.UTC(2026, 8, 16, 10)
const question: Question = {
  id: 'q-9',
  type: QuestionType.SingleChoice,
  stem: '文段意在说明什么？',
  options: ['选项A', '选项B', '选项C', '选项D'],
  answer: 'B',
  analysis: '高频主题词应贯穿全文。',
  subject: '言语理解',
  chapter: '片段阅读',
}

describe('createOrUpdatePracticeWrong', () => {
  it('creates a due wrong-book entry from a practice mistake', () => {
    const entry = createOrUpdatePracticeWrong({
      bankId: 'bank-1',
      bankName: '海海刷·片段',
      question,
      userAnswer: 'A',
    }, null, NOW, () => 'stable-id')

    expect(entry.id).toBe('stable-id')
    expect(entry.sourceKey).toBe('practice:bank-1:q-9')
    expect(entry.title).toBe('海海刷·片段｜文段意在说明什么？')
    expect(entry.userAnswer).toBe('A')
    expect(entry.review.due).toBe(NOW)
    expect(entry.wrongCount).toBe(1)
  })

  it('updates the same record on a repeated mistake', () => {
    const first = createOrUpdatePracticeWrong({
      bankId: 'bank-1', bankName: '题库', question, userAnswer: 'A',
    }, null, NOW, () => 'stable-id')
    const second = createOrUpdatePracticeWrong({
      bankId: 'bank-1', bankName: '题库', question, userAnswer: 'C',
    }, first, NOW + 5_000, () => 'different-id')

    expect(second.id).toBe('stable-id')
    expect(second.wrongCount).toBe(2)
    expect(second.userAnswer).toBe('C')
    expect(second.review.due).toBe(NOW + 5_000)
    expect(second.createdAt).toBe(NOW)
  })
})
