import type { Analysis } from '@/lib/types'

const DB_NAME = 'grasp'
const STORE = 'analyses'
const DB_VERSION = 1

const memory = new Map<string, Analysis>()
const MEMORY_MAX = 500

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

interface Row {
  key: string
  analysis: Analysis
  savedAt: number
}

export async function get(key: string): Promise<{ analysis: Analysis; from: 'memory' | 'idb' } | null> {
  const hit = memory.get(key)
  if (hit) return { analysis: hit, from: 'memory' }

  try {
    const db = await openDb()
    const row = await new Promise<Row | undefined>((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result as Row | undefined)
      req.onerror = () => reject(req.error)
    })
    if (!row) return null
    remember(key, row.analysis)
    return { analysis: row.analysis, from: 'idb' }
  } catch {
    return null
  }
}

export async function set(key: string, analysis: Analysis): Promise<void> {
  remember(key, analysis)
  try {
    const db = await openDb()
    const row: Row = { key, analysis, savedAt: Date.now() }
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(row)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  } catch {}
}

function remember(key: string, analysis: Analysis) {
  if (memory.size >= MEMORY_MAX) {
    const oldest = memory.keys().next().value
    if (oldest !== undefined) memory.delete(oldest)
  }
  memory.set(key, analysis)
}

export async function clear(): Promise<void> {
  memory.clear()
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
