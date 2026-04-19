"use client";

import { useEffect, useState, useCallback } from "react";

const DB_NAME = "feed-post-ref-images";
const STORE_NAME = "images";
const DB_VERSION = 1;

export type StoredImage = {
  id: string;
  filename: string;
  category: string;
  dataUrl: string;
  width: number;
  height: number;
  addedAt: number;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAllImages(): Promise<StoredImage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function saveImage(img: StoredImage): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(img);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteImage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllImages(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function inferCategory(filename: string): string {
  const fn = filename.toLowerCase();
  if (/^(cover|表紙)/.test(fn)) return "cover";
  if (/^(intro|導入|問題)/.test(fn)) return "intro";
  if (/^(item|項目|対処)/.test(fn)) return "item";
  if (/^(diagram|図解|比較)/.test(fn)) return "diagram";
  if (/^(summary|まとめ)/.test(fn)) return "summary";
  if (/^(cta|フォロー)/.test(fn)) return "cta";
  return "general";
}

function fileToDataUrl(file: File, maxWidth = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useReferenceImages() {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const imgs = await getAllImages();
      setImages(imgs.sort((a, b) => a.addedAt - b.addedAt));
    } catch {
      setImages([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        try {
          const dataUrl = await fileToDataUrl(file);
          const img: StoredImage = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            filename: file.name,
            category: inferCategory(file.name),
            dataUrl,
            width: 0,
            height: 0,
            addedAt: Date.now(),
          };
          await saveImage(img);
        } catch (e) {
          console.error("Failed to save image:", file.name, e);
        }
      }
      await reload();
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteImage(id);
      await reload();
    },
    [reload]
  );

  const clearAll = useCallback(async () => {
    await clearAllImages();
    await reload();
  }, [reload]);

  const updateCategory = useCallback(
    async (id: string, category: string) => {
      const img = images.find((i) => i.id === id);
      if (!img) return;
      await saveImage({ ...img, category });
      await reload();
    },
    [images, reload]
  );

  return { images, loading, addFiles, remove, clearAll, updateCategory };
}

const CATEGORIES = [
  { id: "cover", label: "表紙" },
  { id: "intro", label: "導入" },
  { id: "item", label: "項目" },
  { id: "diagram", label: "図解" },
  { id: "summary", label: "まとめ" },
  { id: "cta", label: "CTA" },
  { id: "general", label: "汎用" },
];

export function ReferenceImageUploader({
  images,
  addFiles,
  remove,
  clearAll,
  updateCategory,
}: {
  images: StoredImage[];
  addFiles: (files: FileList | File[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  updateCategory: (id: string, category: string) => Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  return (
    <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">
          参考画像（{images.length} 枚）
        </h2>
        {images.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-red-600 hover:underline"
          >
            全て削除
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        セゾンファンデックスの過去投稿画像をドラッグ＆ドロップで追加。
        カテゴリを設定すると、生成結果の該当スライド横に自動表示されます。
        画像はこのブラウザ内に保存されます（リロードしても消えません）。
      </p>

      {/* ドロップゾーン */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
          dragging
            ? "border-blue-500 bg-blue-50"
            : "border-slate-300 bg-slate-50"
        }`}
      >
        <p className="text-sm text-slate-600 mb-2">
          画像をここにドラッグ＆ドロップ
        </p>
        <label className="inline-block px-4 py-1.5 rounded bg-blue-600 text-white text-sm cursor-pointer hover:bg-blue-700">
          ファイルを選択
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {/* 画像一覧 */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative group border border-slate-200 rounded overflow-hidden"
            >
              <img
                src={img.dataUrl}
                alt={img.filename}
                className="w-full aspect-[4/5] object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition flex items-end">
                <div className="w-full p-1 opacity-0 group-hover:opacity-100 transition space-y-1">
                  <select
                    value={img.category}
                    onChange={(e) => updateCategory(img.id, e.target.value)}
                    className="w-full text-[10px] rounded px-1 py-0.5 bg-white/90"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(img.id)}
                    className="w-full text-[10px] bg-red-600 text-white rounded px-1 py-0.5"
                  >
                    削除
                  </button>
                </div>
              </div>
              <span className="absolute top-0.5 left-0.5 text-[9px] bg-blue-600/80 text-white px-1 rounded">
                {CATEGORIES.find((c) => c.id === img.category)?.label ||
                  img.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
