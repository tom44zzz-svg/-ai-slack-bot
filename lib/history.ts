"use client";

// 生成履歴のローカルストレージ（IndexedDB）
// 直近 30 件を保持し、古いものは自動削除。

const DB_NAME = "feed-post-history";
const STORE_NAME = "generations";
const DB_VERSION = 1;
const MAX_ENTRIES = 30;

export type HistoryEntry = {
  id: string;
  createdAt: number;
  topic: string;
  target?: string;
  goal?: string;
  format_id: string;
  format_name: string;
  feedback_history: string[];
  result: any; // GenerateResult
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveHistory(entry: Omit<HistoryEntry, "id" | "createdAt">): Promise<HistoryEntry> {
  const full: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put(full);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // 超過分を削除
    await trimToMax();
  } catch (e) {
    console.error("saveHistory failed:", e);
  }
  return full;
}

export async function getAllHistory(): Promise<HistoryEntry[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const all = (req.result as HistoryEntry[]) || [];
        resolve(all.sort((a, b) => b.createdAt - a.createdAt));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function deleteHistory(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("deleteHistory failed:", e);
  }
}

export async function clearAllHistory(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error("clearAllHistory failed:", e);
  }
}

async function trimToMax(): Promise<void> {
  const all = await getAllHistory();
  if (all.length <= MAX_ENTRIES) return;
  const toDelete = all.slice(MAX_ENTRIES);
  for (const e of toDelete) {
    await deleteHistory(e.id);
  }
}
