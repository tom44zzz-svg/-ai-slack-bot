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

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader result is not a string"));
      }
    };
    reader.onerror = () => reject(reader.error);
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

  const addTestImage = useCallback(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext("2d")!;
    const colors = ["#174A9A", "#3B6FB8", "#FFD93D", "#FDF8EE"];
    const color = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 400, 500);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("テスト参考画像", 200, 240);
    ctx.font = "20px sans-serif";
    ctx.fillText(new Date().toLocaleTimeString(), 200, 280);
    const dataUrl = canvas.toDataURL("image/png");
    const img: StoredImage = {
      id: `test-${Date.now()}`,
      filename: `test_${Date.now()}.png`,
      category: ["cover", "item", "diagram", "intro"][Math.floor(Math.random() * 4)],
      dataUrl,
      width: 400,
      height: 500,
      addedAt: Date.now(),
    };
    await saveImage(img);
    await reload();
  }, [reload]);

  return { images, loading, addFiles, remove, clearAll, updateCategory, addTestImage };
}

const CATEGORIES = [
  { group: "表紙", items: [
    { id: "cover_pill", label: "表紙：カテゴリ＋タイトル" },
    { id: "cover_number", label: "表紙：数字強調" },
    { id: "cover_question", label: "表紙：問いかけ" },
  ]},
  { group: "導入", items: [
    { id: "intro_quote", label: "問題提起：引用＋写真" },
    { id: "intro_compare", label: "導入：比較表" },
    { id: "intro_stat", label: "導入：大数字" },
  ]},
  { group: "項目（図解別）", items: [
    { id: "item_beforeafter", label: "項目：Before/After 対比" },
    { id: "item_icons3", label: "項目：3アイコン並列" },
    { id: "item_cards3", label: "項目：3列カード" },
    { id: "item_cards2x2", label: "項目：2×2 グリッド" },
    { id: "item_photo", label: "項目：写真＋説明" },
    { id: "item_persona", label: "項目：人物＋○×選択" },
    { id: "item_flow", label: "項目：矢印ステップ" },
    { id: "item_warning", label: "項目：警告ボックス" },
    { id: "item_checklist", label: "項目：チェックリスト" },
    { id: "item_table", label: "項目：比較表（複数行）" },
    { id: "item_ranking", label: "項目：ランキング" },
    { id: "item_graph", label: "項目：グラフ" },
    { id: "item_number", label: "項目：大数字強調" },
    { id: "item_quote", label: "項目：引用吹き出し" },
  ]},
  { group: "まとめ / CTA", items: [
    { id: "summary_recommend", label: "まとめ：ケース別推薦" },
    { id: "summary_keypoints", label: "まとめ：要点リスト" },
    { id: "cta_phone", label: "CTA：スマホUI型" },
    { id: "cta_illust", label: "CTA：イラスト型" },
  ]},
  { group: "その他", items: [
    { id: "general", label: "汎用（分類なし）" },
  ]},
];

const ALL_CATEGORY_ITEMS = CATEGORIES.flatMap((g) => g.items);

export function ReferenceImageUploader({
  images,
  addFiles,
  remove,
  clearAll,
  updateCategory,
  addTestImage,
}: {
  images: StoredImage[];
  addFiles: (files: FileList | File[]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  updateCategory: (id: string, category: string) => Promise<void>;
  addTestImage: () => Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lastError, setLastError] = useState<string>("");

  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      setLastError("");
      try {
        await addFiles(files);
      } catch (e: any) {
        setLastError(e?.message || "アップロードに失敗しました");
      }
      setUploading(false);
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
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
          {uploading
            ? "⏳ アップロード中…"
            : dragging
            ? "ここにドロップ！"
            : "画像をここにドラッグ＆ドロップ"}
        </p>
        {lastError && (
          <p className="text-xs text-red-600 mb-2">{lastError}</p>
        )}
        <div className="flex gap-2 justify-center">
          <label className="inline-block px-4 py-1.5 rounded bg-blue-600 text-white text-sm cursor-pointer hover:bg-blue-700">
            ファイルを選択
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={addTestImage}
            className="px-4 py-1.5 rounded border border-slate-300 text-slate-600 text-sm hover:bg-slate-100"
          >
            テスト画像を追加
          </button>
        </div>
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
                    {CATEGORIES.map((g) => (
                      <optgroup key={g.group} label={g.group}>
                        {g.items.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </optgroup>
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
              <span className="absolute top-0.5 left-0.5 text-[9px] bg-blue-600/80 text-white px-1 rounded max-w-[90%] truncate">
                {ALL_CATEGORY_ITEMS.find((c) => c.id === img.category)?.label ||
                  img.category}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
