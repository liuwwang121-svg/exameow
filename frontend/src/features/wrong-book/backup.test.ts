import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createWrongBookBackup, restoreWrongBookBackup } from './backup'
import { IndexedDbWrongBookRepository } from './indexedDbRepository'
import { createInitialReviewState } from './scheduler'
import type { WrongBookEntry } from './model'

function repo() {
  return new IndexedDbWrongBookRepository(`backup-test-${crypto.randomUUID()}`)
}

function sampleEntry(): WrongBookEntry {
  return {
    id: 'entry-1', schemaVersion: 1, source: 'manual', title: '资料分析错题', recordedAt: 10,
    subject: '资料分析', section: '增长率', stem: '题干', options: [], answer: 'B', analysis: '解析',
    userAnswer: 'A', notes: '', aiAnalysis: '', cause: '计算错误', blocks: [{ kind: 'image', assetId: 'asset-1' }],
    assetIds: ['asset-1'], wrongCount: 1, needsConfirmation: false, review: createInitialReviewState(10),
    createdAt: 10, updatedAt: 10,
  }
}

describe('wrong-book backup', () => {
  it('round-trips entries, review state and image bytes', async () => {
    const source = repo()
    await source.putEntry(sampleEntry())
    await source.putAsset({
      id: 'asset-1', entryId: 'entry-1', mimeType: 'image/png',
      blob: new Blob([new Uint8Array([9, 8, 7])], { type: 'image/png' }), createdAt: 10,
    })

    const json = await createWrongBookBackup(source, 123)
    const parsed = JSON.parse(json)
    expect(parsed).toMatchObject({ schema_version: 1, exported_at: 123 })
    expect(parsed.entries[0].review.due).toBe(10)
    expect(parsed.assets[0].data_base64).toBe('CQgH')

    const target = repo()
    const result = await restoreWrongBookBackup(target, json)
    const restoredAsset = await target.getAsset('asset-1')
    expect(result).toEqual({ entries: 1, assets: 1 })
    expect((await target.getEntry('entry-1'))?.title).toBe('资料分析错题')
    expect(Array.from(new Uint8Array(await restoredAsset!.blob.arrayBuffer()))).toEqual([9, 8, 7])
  })

  it('rejects an unknown schema before deleting existing data', async () => {
    const target = repo()
    await target.putEntry(sampleEntry())

    await expect(restoreWrongBookBackup(target, JSON.stringify({ schema_version: 99, entries: [], assets: [] })))
      .rejects.toThrow('不支持')
    await expect(target.getEntry('entry-1')).resolves.not.toBeNull()
  })
})
