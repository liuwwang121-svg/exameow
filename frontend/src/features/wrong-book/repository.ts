import type { WrongBookAsset, WrongBookEntry } from './model'

export interface WrongBookRepository {
  listEntries(): Promise<WrongBookEntry[]>
  getEntry(id: string): Promise<WrongBookEntry | null>
  findBySourceKey(sourceKey: string): Promise<WrongBookEntry | null>
  putEntry(entry: WrongBookEntry): Promise<void>
  putEntries(entries: WrongBookEntry[]): Promise<void>
  deleteEntry(id: string): Promise<void>
  putAsset(asset: WrongBookAsset): Promise<void>
  putAssets(assets: WrongBookAsset[]): Promise<void>
  getAsset(id: string): Promise<WrongBookAsset | null>
  listAssets(entryId?: string): Promise<WrongBookAsset[]>
  getSetting<T>(key: string): Promise<T | null>
  setSetting<T>(key: string, value: T): Promise<void>
  replaceAll(entries: WrongBookEntry[], assets: WrongBookAsset[]): Promise<void>
  clearAll(): Promise<void>
}
