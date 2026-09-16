import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { AIConfig } from '@exameow/shared'
import {
  WRONG_BOOK_SCHEMA_VERSION,
  type DocxImportPreview,
  type ReviewRating,
  type WrongBookAsset,
  type WrongBookEntry,
  type WrongCause,
} from '@/features/wrong-book/model'
import { IndexedDbWrongBookRepository } from '@/features/wrong-book/indexedDbRepository'
import type { PracticeWrongInput } from '@/features/wrong-book/entryFactory'
import { createOrUpdatePracticeWrong } from '@/features/wrong-book/entryFactory'
import { createInitialReviewState, scheduleReview } from '@/features/wrong-book/scheduler'
import { importWrongBookDocx } from '@/features/wrong-book/docxImporter'
import { createWrongBookBackup, restoreWrongBookBackup } from '@/features/wrong-book/backup'
import { analyzeWrongEntry } from '@/features/wrong-book/aiAnalysis'
import { localDateKey, shouldShowDailyReminder } from '@/features/wrong-book/reminder'

const repository = new IndexedDbWrongBookRepository()

export interface ManualWrongInput {
  title: string
  subject: string
  section: string
  stem: string
  answer: string
  analysis: string
  userAnswer: string
  notes: string
  cause: WrongCause
  customCause?: string
  images: Blob[]
}

function sortEntries(items: WrongBookEntry[]): WrongBookEntry[] {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt)
}

export const useWrongBookStore = defineStore('wrongBook', () => {
  const entries = ref<WrongBookEntry[]>([])
  const initialized = ref(false)
  const loading = ref(false)
  const docxPreview = ref<DocxImportPreview | null>(null)
  const error = ref('')
  const dueNow = ref(Date.now())

  const dueEntries = computed(() => entries.value
    .filter(entry => entry.review.due <= dueNow.value)
    .sort((a, b) => a.review.due - b.review.due))
  const dueCount = computed(() => dueEntries.value.length)

  async function initialize() {
    if (initialized.value) return
    loading.value = true
    try {
      entries.value = await repository.listEntries()
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  function refreshDueNow(now = Date.now()) {
    dueNow.value = now
  }

  function replaceLocal(entry: WrongBookEntry) {
    const index = entries.value.findIndex(item => item.id === entry.id)
    if (index >= 0) entries.value[index] = entry
    else entries.value.push(entry)
    entries.value = sortEntries(entries.value)
  }

  async function recordPracticeWrong(input: PracticeWrongInput, now = Date.now()) {
    refreshDueNow(now)
    const sourceKey = `practice:${input.bankId}:${input.question.id}`
    const existing = await repository.findBySourceKey(sourceKey)
    const entry = createOrUpdatePracticeWrong(input, existing, now)
    await repository.putEntry(entry)
    replaceLocal(entry)
    return entry
  }

  async function addManual(input: ManualWrongInput, now = Date.now()): Promise<WrongBookEntry> {
    refreshDueNow(now)
    const id = crypto.randomUUID()
    const assets: WrongBookAsset[] = input.images.map(blob => ({
      id: crypto.randomUUID(), entryId: id, mimeType: blob.type || 'application/octet-stream', blob, createdAt: now,
    }))
    const entry: WrongBookEntry = {
      id,
      schemaVersion: WRONG_BOOK_SCHEMA_VERSION,
      source: 'manual',
      title: input.title.trim() || input.stem.trim().slice(0, 40) || '手动录入错题',
      recordedAt: now,
      subject: input.subject,
      section: input.section,
      stem: input.stem.trim(),
      options: [],
      answer: input.answer.trim(),
      analysis: input.analysis.trim(),
      userAnswer: input.userAnswer.trim(),
      notes: input.notes.trim(),
      aiAnalysis: '',
      cause: input.cause,
      customCause: input.customCause?.trim() || undefined,
      blocks: [
        ...(input.stem.trim() ? [{ kind: 'text' as const, text: input.stem.trim() }] : []),
        ...assets.map(asset => ({ kind: 'image' as const, assetId: asset.id, alt: '' })),
      ],
      assetIds: assets.map(asset => asset.id),
      wrongCount: 1,
      needsConfirmation: false,
      review: createInitialReviewState(now),
      createdAt: now,
      updatedAt: now,
    }
    await repository.putEntry(entry)
    await repository.putAssets(assets)
    replaceLocal(entry)
    return entry
  }

  async function previewDocx(buffer: ArrayBuffer): Promise<DocxImportPreview> {
    loading.value = true
    error.value = ''
    try {
      docxPreview.value = await importWrongBookDocx(buffer)
      return docxPreview.value
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause)
      throw cause
    } finally {
      loading.value = false
    }
  }

  function setDocxPreview(preview: DocxImportPreview | null) {
    docxPreview.value = preview
  }

  async function confirmDocxImport(): Promise<number> {
    const preview = docxPreview.value
    if (!preview || preview.entries.length === 0) return 0
    const entryByAsset = new Map<string, string>()
    for (const entry of preview.entries) {
      for (const assetId of entry.assetIds) entryByAsset.set(assetId, entry.id)
    }
    const assets: WrongBookAsset[] = preview.assets.flatMap(asset => {
      const entryId = entryByAsset.get(asset.id)
      return entryId ? [{ ...asset, entryId, createdAt: Date.now() }] : []
    })
    await repository.putEntries(preview.entries)
    await repository.putAssets(assets)
    entries.value = sortEntries([...entries.value, ...preview.entries])
    refreshDueNow()
    const count = preview.entries.length
    docxPreview.value = null
    return count
  }

  async function rateEntry(id: string, rating: ReviewRating, now = Date.now()) {
    refreshDueNow(now)
    const entry = entries.value.find(item => item.id === id)
    if (!entry) return
    const updated = { ...entry, review: scheduleReview(entry.review, rating, now), updatedAt: now }
    await repository.putEntry(updated)
    replaceLocal(updated)
  }

  async function updateEntry(id: string, patch: Partial<Pick<WrongBookEntry, 'cause' | 'customCause' | 'notes' | 'answer' | 'analysis' | 'needsConfirmation'>>) {
    const entry = entries.value.find(item => item.id === id)
    if (!entry) return
    const updated = { ...entry, ...patch, updatedAt: Date.now() }
    await repository.putEntry(updated)
    replaceLocal(updated)
  }

  async function removeEntry(id: string) {
    await repository.deleteEntry(id)
    entries.value = entries.value.filter(item => item.id !== id)
  }

  async function getAsset(id: string) {
    return repository.getAsset(id)
  }

  async function exportBackup() {
    return createWrongBookBackup(repository)
  }

  async function restoreBackup(json: string) {
    const result = await restoreWrongBookBackup(repository, json)
    entries.value = await repository.listEntries()
    return result
  }

  async function runAiAnalysis(id: string, config: AIConfig, signal?: AbortSignal) {
    const entry = entries.value.find(item => item.id === id)
    if (!entry) throw new Error('错题不存在。')
    const suggestion = await analyzeWrongEntry(entry, config, signal)
    const updated: WrongBookEntry = {
      ...entry,
      aiSuggestedCause: suggestion.cause,
      aiAnalysis: suggestion.explanation,
      updatedAt: Date.now(),
    }
    await repository.putEntry(updated)
    replaceLocal(updated)
    return suggestion
  }

  async function consumeDailyReminder(today = localDateKey()): Promise<number> {
    await initialize()
    refreshDueNow()
    const lastShown = await repository.getSetting<string>('lastReminderDate')
    if (!shouldShowDailyReminder(dueCount.value, lastShown, today)) return 0
    await repository.setSetting('lastReminderDate', today)
    return dueCount.value
  }

  return {
    entries,
    initialized,
    loading,
    docxPreview,
    error,
    dueEntries,
    dueCount,
    refreshDueNow,
    initialize,
    recordPracticeWrong,
    addManual,
    previewDocx,
    setDocxPreview,
    confirmDocxImport,
    rateEntry,
    updateEntry,
    removeEntry,
    getAsset,
    exportBackup,
    restoreBackup,
    runAiAnalysis,
    consumeDailyReminder,
  }
})
