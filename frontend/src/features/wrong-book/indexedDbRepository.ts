import type { WrongBookAsset, WrongBookEntry } from './model'
import type { WrongBookRepository } from './repository'

const DB_VERSION = 1
const ENTRIES = 'entries'
const ASSETS = 'assets'
const SETTINGS = 'settings'

function toStorableEntry(entry: WrongBookEntry): WrongBookEntry {
  // Pinia exposes deeply reactive proxies. IndexedDB's structured-clone
  // algorithm rejects proxies, while this model intentionally contains only
  // JSON-safe metadata (binary data lives in the asset store).
  return JSON.parse(JSON.stringify(entry)) as WrongBookEntry
}

interface SettingRecord<T = unknown> {
  key: string
  value: T
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
}

export class IndexedDbWrongBookRepository implements WrongBookRepository {
  private dbPromise: Promise<IDBDatabase> | null = null

  constructor(private readonly dbName = 'exameow-wrong-book') {}

  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(ENTRIES)) {
          const store = db.createObjectStore(ENTRIES, { keyPath: 'id' })
          store.createIndex('sourceKey', 'sourceKey', { unique: false })
          store.createIndex('updatedAt', 'updatedAt', { unique: false })
        }
        if (!db.objectStoreNames.contains(ASSETS)) {
          const store = db.createObjectStore(ASSETS, { keyPath: 'id' })
          store.createIndex('entryId', 'entryId', { unique: false })
        }
        if (!db.objectStoreNames.contains(SETTINGS)) {
          db.createObjectStore(SETTINGS, { keyPath: 'key' })
        }
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        this.dbPromise = null
        reject(request.error ?? new Error('Unable to open wrong-book database'))
      }
    })
    return this.dbPromise
  }

  async listEntries(): Promise<WrongBookEntry[]> {
    const db = await this.open()
    const values = await requestResult(db.transaction(ENTRIES).objectStore(ENTRIES).getAll()) as WrongBookEntry[]
    return values.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getEntry(id: string): Promise<WrongBookEntry | null> {
    const db = await this.open()
    const value = await requestResult(db.transaction(ENTRIES).objectStore(ENTRIES).get(id)) as WrongBookEntry | undefined
    return value ?? null
  }

  async findBySourceKey(sourceKey: string): Promise<WrongBookEntry | null> {
    const db = await this.open()
    const value = await requestResult(db.transaction(ENTRIES).objectStore(ENTRIES).index('sourceKey').get(sourceKey)) as WrongBookEntry | undefined
    return value ?? null
  }

  async putEntry(entry: WrongBookEntry): Promise<void> {
    return this.putEntries([entry])
  }

  async putEntries(entries: WrongBookEntry[]): Promise<void> {
    if (entries.length === 0) return
    const db = await this.open()
    const tx = db.transaction(ENTRIES, 'readwrite')
    const store = tx.objectStore(ENTRIES)
    for (const entry of entries) store.put(toStorableEntry(entry))
    await transactionDone(tx)
  }

  async deleteEntry(id: string): Promise<void> {
    const db = await this.open()
    const tx = db.transaction([ENTRIES, ASSETS], 'readwrite')
    tx.objectStore(ENTRIES).delete(id)
    const cursorRequest = tx.objectStore(ASSETS).index('entryId').openKeyCursor(IDBKeyRange.only(id))
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result
      if (!cursor) return
      tx.objectStore(ASSETS).delete(cursor.primaryKey)
      cursor.continue()
    }
    await transactionDone(tx)
  }

  async putAsset(asset: WrongBookAsset): Promise<void> {
    return this.putAssets([asset])
  }

  async putAssets(assets: WrongBookAsset[]): Promise<void> {
    if (assets.length === 0) return
    const db = await this.open()
    const tx = db.transaction(ASSETS, 'readwrite')
    const store = tx.objectStore(ASSETS)
    for (const asset of assets) store.put(asset)
    await transactionDone(tx)
  }

  async getAsset(id: string): Promise<WrongBookAsset | null> {
    const db = await this.open()
    const value = await requestResult(db.transaction(ASSETS).objectStore(ASSETS).get(id)) as WrongBookAsset | undefined
    return value ?? null
  }

  async listAssets(entryId?: string): Promise<WrongBookAsset[]> {
    const db = await this.open()
    const store = db.transaction(ASSETS).objectStore(ASSETS)
    const request = entryId ? store.index('entryId').getAll(entryId) : store.getAll()
    return await requestResult(request) as WrongBookAsset[]
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const db = await this.open()
    const record = await requestResult(db.transaction(SETTINGS).objectStore(SETTINGS).get(key)) as SettingRecord<T> | undefined
    return record?.value ?? null
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const db = await this.open()
    const tx = db.transaction(SETTINGS, 'readwrite')
    tx.objectStore(SETTINGS).put({ key, value } satisfies SettingRecord<T>)
    await transactionDone(tx)
  }

  async clearAll(): Promise<void> {
    const db = await this.open()
    const tx = db.transaction([ENTRIES, ASSETS, SETTINGS], 'readwrite')
    tx.objectStore(ENTRIES).clear()
    tx.objectStore(ASSETS).clear()
    tx.objectStore(SETTINGS).clear()
    await transactionDone(tx)
  }

  async replaceAll(entries: WrongBookEntry[], assets: WrongBookAsset[]): Promise<void> {
    const db = await this.open()
    const tx = db.transaction([ENTRIES, ASSETS, SETTINGS], 'readwrite')
    const entryStore = tx.objectStore(ENTRIES)
    const assetStore = tx.objectStore(ASSETS)
    entryStore.clear()
    assetStore.clear()
    tx.objectStore(SETTINGS).clear()
    for (const entry of entries) entryStore.put(toStorableEntry(entry))
    for (const asset of assets) assetStore.put(asset)
    await transactionDone(tx)
  }
}
