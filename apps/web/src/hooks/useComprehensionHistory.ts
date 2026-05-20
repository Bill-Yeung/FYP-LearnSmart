import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth } from "../contexts/AuthContext"

const DB_NAME = "learnsmart-comprehension-history"
const DB_VERSION = 1
const STORE_NAME = "sessions"

export type ComprehensionHistoryRecord<TPayload> = {
  id: string
  ownerId: string
  moduleKey: string
  sessionId: string
  title: string
  preview: string
  meta?: string[]
  payload: TPayload
  updatedAt: number
}

type HistoryOptions<TPayload> = {
  moduleKey: string
  payload: TPayload
  shouldStore: (payload: TPayload) => boolean
  getTitle: (payload: TPayload) => string
  getPreview: (payload: TPayload) => string
  getMeta?: (payload: TPayload) => string[]
  maxItems?: number
  debounceMs?: number
}

function createSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("moduleKey", "moduleKey", { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
) {
  const db = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const request = run(transaction.objectStore(STORE_NAME))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

async function loadRecords<TPayload>(moduleKey: string, ownerId: string, maxItems: number) {
  const records = await withStore<ComprehensionHistoryRecord<TPayload>[]>(
    "readonly",
    (store) => store.getAll() as IDBRequest<ComprehensionHistoryRecord<TPayload>[]>
  )

  return records
    .filter((record) => record.moduleKey === moduleKey && record.ownerId === ownerId)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, maxItems)
}

async function saveRecord<TPayload>(
  record: ComprehensionHistoryRecord<TPayload>,
  maxItems: number
) {
  await withStore<IDBValidKey>("readwrite", (store) => store.put(record))

  const records = await loadRecords<TPayload>(record.moduleKey, record.ownerId, Number.MAX_SAFE_INTEGER)
  const staleRecords = records.slice(maxItems)
  await Promise.all(
    staleRecords.map((item) =>
      withStore<undefined>("readwrite", (store) => store.delete(item.id) as IDBRequest<undefined>)
    )
  )
}

async function deleteRecord(id: string) {
  await withStore<undefined>("readwrite", (store) => store.delete(id) as IDBRequest<undefined>)
}

async function clearModuleRecords(moduleKey: string, ownerId: string) {
  const records = await loadRecords<unknown>(moduleKey, ownerId, Number.MAX_SAFE_INTEGER)
  await Promise.all(records.map((item) => deleteRecord(item.id)))
}

function getPayloadSignature(payload: unknown) {
  try {
    return JSON.stringify(payload)
  } catch {
    return ""
  }
}

export function useComprehensionHistory<TPayload>({
  moduleKey,
  payload,
  shouldStore,
  getTitle,
  getPreview,
  getMeta,
  maxItems = 8,
  debounceMs = 500
}: HistoryOptions<TPayload>) {
  const { user } = useAuth()
  const ownerId = user?.id ? String(user.id) : ""
  const [sessionId, setSessionId] = useState(() => createSessionId())
  const [items, setItems] = useState<ComprehensionHistoryRecord<TPayload>[]>([])
  const deletedRecordIdsRef = useRef(new Set<string>())
  const suppressedPayloadSignatureRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    if (!ownerId) {
      void Promise.resolve().then(() => {
        if (active) setItems([])
      })
      return () => {
        active = false
      }
    }

    void loadRecords<TPayload>(moduleKey, ownerId, maxItems)
      .then((records) => {
        if (active) setItems(records)
      })
      .catch(() => {
        if (active) setItems([])
      })

    return () => {
      active = false
    }
  }, [maxItems, moduleKey, ownerId])

  useEffect(() => {
    if (!ownerId) return
    if (!shouldStore(payload)) return
    const payloadSignature = getPayloadSignature(payload)
    if (suppressedPayloadSignatureRef.current === payloadSignature) return
    suppressedPayloadSignatureRef.current = null

    const timer = window.setTimeout(() => {
      const record: ComprehensionHistoryRecord<TPayload> = {
        id: `${ownerId}:${moduleKey}:${sessionId}`,
        ownerId,
        moduleKey,
        sessionId,
        title: getTitle(payload),
        preview: getPreview(payload),
        meta: getMeta?.(payload) ?? [],
        payload,
        updatedAt: Date.now()
      }

      if (deletedRecordIdsRef.current.has(record.id)) return
      deletedRecordIdsRef.current.clear()

      void saveRecord(record, maxItems)
        .then(() => loadRecords<TPayload>(moduleKey, ownerId, maxItems))
        .then(setItems)
        .catch(() => undefined)
    }, debounceMs)

    return () => window.clearTimeout(timer)
  }, [debounceMs, getMeta, getPreview, getTitle, maxItems, moduleKey, ownerId, payload, sessionId, shouldStore])

  const removeSavedItem = useCallback(async (id: string) => {
    deletedRecordIdsRef.current.add(id)
    await deleteRecord(id)
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const clearSavedItems = useCallback(async () => {
    if (!ownerId) return
    suppressedPayloadSignatureRef.current = getPayloadSignature(payload)
    deletedRecordIdsRef.current.clear()
    await clearModuleRecords(moduleKey, ownerId)
    setItems([])
  }, [moduleKey, ownerId, payload])

  return {
    storedItems: items,
    markRestoredSession: (nextSessionId: string) => setSessionId(nextSessionId),
    startNewSession: () => setSessionId(createSessionId()),
    removeSavedItem,
    clearSavedItems
  }
}
