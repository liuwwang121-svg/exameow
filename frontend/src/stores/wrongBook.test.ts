import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { QuestionType, type Question } from '@exameow/shared'
import { useWrongBookStore } from './wrongBook'
import { IndexedDbWrongBookRepository } from '@/features/wrong-book/indexedDbRepository'
import { createInitialReviewState } from '@/features/wrong-book/scheduler'
import type { DocxImportPreview, WrongBookEntry } from '@/features/wrong-book/model'

const analyzeWrongEntryMock = vi.hoisted(() => vi.fn())
vi.mock('@/features/wrong-book/aiAnalysis', () => ({ analyzeWrongEntry: analyzeWrongEntryMock }))

const question: Question = {
  id: 'q1', type: QuestionType.SingleChoice, stem: '增长率是多少？', options: ['1%', '2%'],
  answer: 'B', analysis: '现期除以基期。', subject: '资料分析', chapter: '增长率',
}

beforeEach(async () => {
  vi.clearAllMocks()
  setActivePinia(createPinia())
  await new IndexedDbWrongBookRepository().clearAll()
})

describe('wrong-book store', () => {
  it('keeps one entry and increments its count when the same question is wrong twice', async () => {
    const store = useWrongBookStore()
    await store.initialize()
    await store.recordPracticeWrong({ bankId: 'bank', bankName: '资料套题', question, userAnswer: 'A' })
    await store.recordPracticeWrong({ bankId: 'bank', bankName: '资料套题', question, userAnswer: 'A' })

    expect(store.entries).toHaveLength(1)
    expect(store.entries[0]!.wrongCount).toBe(2)
    expect(store.dueCount).toBe(1)
  })

  it('does not persist a DOCX preview until the user confirms it', async () => {
    const store = useWrongBookStore()
    await store.initialize()
    const imported: WrongBookEntry = {
      id: 'docx-1', schemaVersion: 1, source: 'docx', title: '001｜错题', recordedAt: 1,
      subject: '言语理解', section: '片段阅读', stem: '题干', options: [], answer: '', analysis: '',
      userAnswer: '', notes: '', aiAnalysis: '', cause: '审题关键词漏读', blocks: [], assetIds: [],
      wrongCount: 1, needsConfirmation: false, review: createInitialReviewState(1), createdAt: 1, updatedAt: 1,
    }
    const preview: DocxImportPreview = { entries: [imported], assets: [], ignoredCount: 0, warnings: [] }

    store.setDocxPreview(preview)
    expect(store.entries).toEqual([])
    await store.confirmDocxImport()
    expect(store.entries.map(item => item.id)).toEqual(['docx-1'])
  })

  it('updates the next due date when an entry is reviewed', async () => {
    const store = useWrongBookStore()
    const now = Date.now()
    await store.initialize()
    await store.recordPracticeWrong({ bankId: 'bank', bankName: '资料套题', question, userAnswer: 'A' }, now)
    const id = store.entries[0]!.id

    await store.rateEntry(id, 'good', now + 1_000)

    expect(store.entries[0]!.review.reps).toBe(1)
    expect(store.entries[0]!.review.due).toBe(now + 1_000 + 3 * 86_400_000)
    expect(store.dueCount).toBe(0)
  })

  it('refreshes due entries when time advances without changing stored data', async () => {
    const store = useWrongBookStore()
    const now = Date.now()
    await store.initialize()
    const entry = await store.recordPracticeWrong({ bankId: 'bank', bankName: '资料套题', question, userAnswer: 'A' }, now)
    await store.rateEntry(entry.id, 'again', now)

    store.refreshDueNow(now + 9 * 60_000)
    expect(store.dueCount).toBe(0)
    store.refreshDueNow(now + 11 * 60_000)
    expect(store.dueCount).toBe(1)
  })

  it('keeps the user cause unchanged when AI returns a different suggestion', async () => {
    analyzeWrongEntryMock.mockResolvedValue({ cause: '方法错误', explanation: '应先判断题型。' })
    const store = useWrongBookStore()
    await store.initialize()
    const entry = await store.recordPracticeWrong({ bankId: 'bank', bankName: '资料套题', question, userAnswer: 'A' })
    await store.updateEntry(entry.id, { cause: '执行粗心' })

    await store.runAiAnalysis(entry.id, {} as never)

    expect(store.entries[0]!.cause).toBe('执行粗心')
    expect(store.entries[0]!.aiSuggestedCause).toBe('方法错误')
    expect(store.entries[0]!.aiAnalysis).toBe('应先判断题型。')
  })
})
