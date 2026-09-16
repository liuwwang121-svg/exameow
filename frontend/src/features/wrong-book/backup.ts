import { WRONG_BOOK_SCHEMA_VERSION, type WrongBookAsset, type WrongBookEntry } from './model'
import type { WrongBookRepository } from './repository'

interface BackupAsset {
  id: string
  entry_id: string
  mime_type: string
  created_at: number
  data_base64: string
}

interface WrongBookBackup {
  schema_version: typeof WRONG_BOOK_SCHEMA_VERSION
  exported_at: number
  entries: WrongBookEntry[]
  assets: BackupAsset[]
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function base64ToBytes(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export async function createWrongBookBackup(repository: WrongBookRepository, now = Date.now()): Promise<string> {
  const [entries, assets] = await Promise.all([repository.listEntries(), repository.listAssets()])
  const encodedAssets: BackupAsset[] = await Promise.all(assets.map(async asset => ({
    id: asset.id,
    entry_id: asset.entryId,
    mime_type: asset.mimeType,
    created_at: asset.createdAt,
    data_base64: bytesToBase64(new Uint8Array(await asset.blob.arrayBuffer())),
  })))
  const backup: WrongBookBackup = {
    schema_version: WRONG_BOOK_SCHEMA_VERSION,
    exported_at: now,
    entries,
    assets: encodedAssets,
  }
  return JSON.stringify(backup)
}

function validateBackup(value: unknown): WrongBookBackup {
  if (!value || typeof value !== 'object') throw new Error('备份文件格式无效。')
  const candidate = value as Partial<WrongBookBackup>
  if (candidate.schema_version !== WRONG_BOOK_SCHEMA_VERSION) {
    throw new Error(`不支持的备份版本：${String(candidate.schema_version ?? '未知')}`)
  }
  if (!Array.isArray(candidate.entries) || !Array.isArray(candidate.assets)) {
    throw new Error('备份缺少错题或图片数据。')
  }
  for (const entry of candidate.entries) {
    if (!entry || typeof entry.id !== 'string' || entry.schemaVersion !== WRONG_BOOK_SCHEMA_VERSION || !entry.review) {
      throw new Error('备份中存在无效错题记录。')
    }
  }
  for (const asset of candidate.assets) {
    if (!asset || typeof asset.id !== 'string' || typeof asset.entry_id !== 'string'
      || typeof asset.mime_type !== 'string' || typeof asset.data_base64 !== 'string') {
      throw new Error('备份中存在无效图片记录。')
    }
  }
  return candidate as WrongBookBackup
}

export async function restoreWrongBookBackup(
  repository: WrongBookRepository,
  json: string,
): Promise<{ entries: number; assets: number }> {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('备份文件不是有效 JSON。')
  }
  const backup = validateBackup(raw)
  const assets: WrongBookAsset[] = backup.assets.map(asset => ({
    id: asset.id,
    entryId: asset.entry_id,
    mimeType: asset.mime_type,
    createdAt: asset.created_at,
    blob: new Blob([base64ToBytes(asset.data_base64)], { type: asset.mime_type }),
  }))

  await repository.replaceAll(backup.entries, assets)
  return { entries: backup.entries.length, assets: assets.length }
}
