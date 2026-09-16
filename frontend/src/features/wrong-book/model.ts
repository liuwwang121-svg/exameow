export const WRONG_BOOK_SCHEMA_VERSION = 1 as const

export const WRONG_CAUSES = [
  '知识不会/遗忘',
  '方法错误',
  '审题关键词漏读',
  '主体/指标/口径错误',
  '计算错误',
  '选项理解错误',
  '时间/跳题策略',
  '执行粗心',
  '自定义',
] as const

export type WrongCause = typeof WRONG_CAUSES[number]
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'
export type ReviewStateName = 'new' | 'learning' | 'review' | 'relearning'
export type WrongBookSource = 'practice' | 'manual' | 'docx'

export interface ReviewState {
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  state: ReviewStateName
  lastReview: number | null
}

export type WrongBookBlock =
  | { kind: 'text'; text: string }
  | { kind: 'image'; assetId: string; alt?: string }

export interface WrongBookEntry {
  id: string
  schemaVersion: typeof WRONG_BOOK_SCHEMA_VERSION
  source: WrongBookSource
  sourceKey?: string
  title: string
  recordedAt: number
  examDate?: string
  subject: string
  section: string
  originalQuestionNo?: string
  stem: string
  options: string[]
  answer: string
  analysis: string
  userAnswer: string
  notes: string
  aiAnalysis: string
  aiSuggestedCause?: WrongCause
  cause: WrongCause
  customCause?: string
  blocks: WrongBookBlock[]
  assetIds: string[]
  wrongCount: number
  needsConfirmation: boolean
  review: ReviewState
  createdAt: number
  updatedAt: number
}

export interface WrongBookAsset {
  id: string
  entryId: string
  mimeType: string
  blob: Blob
  createdAt: number
}

export interface PendingWrongBookAsset {
  id: string
  mimeType: string
  blob: Blob
}

export interface DocxImportPreview {
  entries: WrongBookEntry[]
  assets: PendingWrongBookAsset[]
  ignoredCount: number
  warnings: string[]
}
