import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { IndexedDbWrongBookRepository } from './indexedDbRepository'
import { createInitialReviewState } from './scheduler'
import type { WrongBookAsset, WrongBookEntry } from './model'

function repository(): IndexedDbWrongBookRepository {
  const name = `wrong-book-test-${crypto.randomUUID()}`
  return new IndexedDbWrongBookRepository(name)
}

function entry(id: string, sourceKey?: string, updatedAt = 1): WrongBookEntry {
  return {
    id,
    schemaVersion: 1,
    source: 'manual',
    sourceKey,
    title: `题目 ${id}`,
    recordedAt: updatedAt,
    subject: '资料分析',
    section: '增长率',
    stem: '题干',
    options: [],
    answer: '答案',
    analysis: '',
    userAnswer: '',
    notes: '',
    aiAnalysis: '',
    cause: '计算错误',
    blocks: [],
    assetIds: [],
    wrongCount: 1,
    needsConfirmation: false,
    review: createInitialReviewState(updatedAt),
    createdAt: updatedAt,
    updatedAt,
  }
}

describe('IndexedDbWrongBookRepository', () => {
  it('lists entries newest first and finds a source key', async () => {
    const repo = repository()
    await repo.putEntry(entry('older', 'practice:a:1', 10))
    await repo.putEntry(entry('newer', 'practice:a:2', 20))

    await expect(repo.listEntries()).resolves.toMatchObject([{ id: 'newer' }, { id: 'older' }])
    await expect(repo.findBySourceKey('practice:a:1')).resolves.toMatchObject({ id: 'older' })
  })

  it('round-trips an image Blob without converting it to localStorage text', async () => {
    const repo = repository()
    const image = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/png' })
    const asset: WrongBookAsset = { id: 'asset-1', entryId: 'entry-1', mimeType: 'image/png', blob: image, createdAt: 5 }

    await repo.putEntry({ ...entry('entry-1'), assetIds: ['asset-1'] })
    await repo.putAsset(asset)
    const restored = await repo.getAsset('asset-1')

    expect(restored?.blob).toBeInstanceOf(Blob)
    expect(Array.from(new Uint8Array(await restored!.blob.arrayBuffer()))).toEqual([1, 2, 3, 4])
  })

  it('deletes assets when their entry is deleted', async () => {
    const repo = repository()
    await repo.putEntry({ ...entry('entry-1'), assetIds: ['asset-1'] })
    await repo.putAsset({
      id: 'asset-1', entryId: 'entry-1', mimeType: 'image/jpeg', blob: new Blob(['x']), createdAt: 5,
    })

    await repo.deleteEntry('entry-1')

    await expect(repo.getEntry('entry-1')).resolves.toBeNull()
    await expect(repo.getAsset('asset-1')).resolves.toBeNull()
  })

  it('stores typed settings and can clear all data', async () => {
    const repo = repository()
    await repo.setSetting('lastReminderDate', '2026-09-16')
    await repo.putEntry(entry('entry-1'))

    await expect(repo.getSetting<string>('lastReminderDate')).resolves.toBe('2026-09-16')
    await repo.clearAll()
    await expect(repo.listEntries()).resolves.toEqual([])
    await expect(repo.getSetting('lastReminderDate')).resolves.toBeNull()
  })

  it('replaces entries, assets, and settings together for backup restore', async () => {
    const repo = repository()
    await repo.putEntry(entry('old'))
    await repo.putAsset({
      id: 'old-asset', entryId: 'old', mimeType: 'image/png', blob: new Blob(['old']), createdAt: 1,
    })
    await repo.setSetting('lastReminderDate', '2026-09-16')
    const replacement = { ...entry('new'), assetIds: ['new-asset'] }
    const replacementAsset: WrongBookAsset = {
      id: 'new-asset', entryId: 'new', mimeType: 'image/png', blob: new Blob(['new']), createdAt: 2,
    }

    await repo.replaceAll([replacement], [replacementAsset])

    await expect(repo.listEntries()).resolves.toMatchObject([{ id: 'new' }])
    await expect(repo.getEntry('old')).resolves.toBeNull()
    await expect(repo.getAsset('old-asset')).resolves.toBeNull()
    await expect(repo.getAsset('new-asset')).resolves.toMatchObject({ entryId: 'new' })
    await expect(repo.getSetting('lastReminderDate')).resolves.toBeNull()
  })
})
