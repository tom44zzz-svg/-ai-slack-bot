"use client";

import { useEffect, useState, useCallback } from "react";

const DRIVE_FOLDER_URL =
  "https://drive.google.com/drive/folders/1Q1vx68G-d3z9HakL54u5jpWR84XCJC5h?usp=sharing";

// ビルド時の固定値。Vercel が再デプロイすればこの文字列が変わる。
// ユーザーがキャッシュ vs 最新版を判定する手がかり。
const BUILD_ID = "build-2026-04-19-step4-fix";

type RefImage = {
  id: string;
  dataUrl: string;
  name: string;
  pattern_id: string; // page-patterns.yaml の P01 等
};

const PATTERN_CHOICES = [
  { group: "表紙", items: [
    { id: "P01", label: "P01 大見出し・保存版型" },
    { id: "P02", label: "P02 カテゴリピル＋タイトル型" },
    { id: "P03", label: "P03 問いかけ型・背景人物" },
    { id: "P04", label: "P04 会話フック型" },
  ]},
  { group: "導入", items: [
    { id: "P10", label: "P10 問題提起・引用型" },
    { id: "P11", label: "P11 比較表・導入型" },
    { id: "P12", label: "P12 大数字・導入型" },
  ]},
  { group: "項目", items: [
    { id: "P20", label: "P20 before/after 対比型" },
    { id: "P21", label: "P21 2列VS型" },
    { id: "P30", label: "P30 3アイコン並列型" },
    { id: "P31", label: "P31 2×2カード型" },
    { id: "P32", label: "P32 3列カード＋キャプション誘導型" },
    { id: "P40", label: "P40 人物＋○×選択型" },
    { id: "P50", label: "P50 番号＋写真＋💡型" },
  ]},
  { group: "まとめ / CTA", items: [
    { id: "P60", label: "P60 ケース別推薦まとめ" },
    { id: "P61", label: "P61 要点チェックリストまとめ" },
    { id: "P90", label: "P90 CTA・家族イラスト型" },
    { id: "P91", label: "P91 CTA・スマホUI型" },
  ]},
  { group: "その他", items: [{ id: "unclassified", label: "未分類" }] },
];

type AxisOption = { id: string; name: string; example?: string };
type FormatSummary = {
  id: string;
  name: string;
  one_liner: string;
  axes: { hook: string; tone: string; structure: string };
  slides: string;
  enterprise_caution: "ok" | "caution" | "avoid";
  risk_count: number;
  example_topics: string[];
};

type SourceVerdict = {
  url: string;
  domain: string;
  classification:
    | "preferred"
    | "official"
    | "corporate_trusted"
    | "corporate_unknown"
    | "personal_blog"
    | "invalid";
  severity: "ok" | "warn" | "block";
  reason: string;
};

type TitleItem = {
  approach?: string;
  tone?: "positive" | "neutral" | "negative";
  text: string;
};
type VerifiedCitation = {
  url: string;
  title?: string;
  page_or_section?: string;
  quote?: string;
  verdict: SourceVerdict;
};
type DiagramInfo = {
  id: string;
  name: string;
  category: string;
  ascii_preview: string;
  use_case: string;
};

type PatternInfo = {
  id: string;
  name: string;
  role: string;
  summary: string;
  based_on?: Array<{ post_id: string; page: string }>;
};

type Slide = {
  index: number;
  role: string;
  template_id: string;
  pattern?: PatternInfo | null;
  zone_top: any;
  zone_middle: any;
  zone_bottom: any;
  photo_hint: string | null;
  diagram: string | null;
  diagram_info?: DiagramInfo | null;
  canva_search_url?: string;
  sources?: VerifiedCitation[];
  svg?: string;
  notes?: string;
};

type GenerateResult = {
  format: { id: string; name: string; axes: any };
  titles: TitleItem[] | string[];
  slides: Slide[];
  caption_outline: string[];
  risk_notes: Array<{ rule_id: string; note: string }>;
  source_summary?: {
    total: number;
    preferred?: number;
    official?: number;
    ok: number;
    warn: number;
    block: number;
  };
  web_search?: { used: boolean; queries: string[]; result_count: number };
  cta_default: string[];
};

export default function Home() {
  const [axisOptions, setAxisOptions] = useState<{
    hook: AxisOption[];
    tone: AxisOption[];
    structure: AxisOption[];
  } | null>(null);

  const [topic, setTopic] = useState("");
  const [target, setTarget] = useState("");
  const [goal, setGoal] = useState("");

  const [hook, setHook] = useState<string>("");
  const [tone, setTone] = useState<string>("");
  const [structure, setStructure] = useState<string>("");

  const [candidates, setCandidates] = useState<{
    exact: FormatSummary[];
    partial: FormatSummary[];
  }>({ exact: [], partial: [] });

  const [selectedFormatId, setSelectedFormatId] = useState<string>("");
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string>("");
  const [feedbackHistory, setFeedbackHistory] = useState<string[]>([]);
  const [feedbackDraft, setFeedbackDraft] = useState<string>("");
  const [refImages, setRefImages] = useState<RefImage[]>([]);

  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = () => {
        setRefImages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            dataUrl: reader.result as string,
            name: file.name,
            pattern_id: "unclassified",
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  useEffect(() => {
    fetchFormats();
  }, [hook, tone, structure]);


  async function fetchFormats() {
    try {
      const params = new URLSearchParams();
      if (hook) params.set("hook", hook);
      if (tone) params.set("tone", tone);
      if (structure) params.set("structure", structure);
      const res = await fetch(`/api/formats?${params}`);
      if (!res.ok) {
        const txt = await res.text();
        setError(
          `/api/formats が失敗しました (HTTP ${res.status})\n${txt.slice(0, 400)}`
        );
        return;
      }
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const txt = await res.text();
        setError(
          `/api/formats が JSON を返しませんでした。\n${txt.slice(0, 400)}`
        );
        return;
      }
      const data = await res.json();
      if (!axisOptions && data.axis_options) setAxisOptions(data.axis_options);
      setCandidates({
        exact: Array.isArray(data.exact) ? data.exact : [],
        partial: Array.isArray(data.partial) ? data.partial : [],
      });
    } catch (e: any) {
      setError(`/api/formats の読み込みエラー: ${e?.message || e}`);
    }
  }

  async function handleGenerate(extraFeedback?: string) {
    if (!topic || !selectedFormatId) return;
    // 追加 FB があれば履歴に積む
    const fbList = extraFeedback
      ? [...feedbackHistory, extraFeedback]
      : feedbackHistory;
    if (extraFeedback) {
      setFeedbackHistory(fbList);
      setFeedbackDraft("");
    }
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          topic,
          target,
          goal,
          format_id: selectedFormatId,
          use_web_search: useWebSearch,
          feedback_history: fbList,
        }),
      });

      // 非 JSON レスポンスの対応（Vercel の 504 タイムアウトは HTML を返す）
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await res.text();
        const isTimeout = res.status === 504 || /gateway timeout|FUNCTION_INVOCATION_TIMEOUT/i.test(text);
        if (isTimeout) {
          setError(
            `HTTP ${res.status} タイムアウト\n` +
              `生成が Vercel の関数実行時間上限を超えました。\n` +
              `対策: (1) Web 検索を OFF にして再試行、(2) Vercel を Pro プランに上げる（60s→300s）、(3) ネタを簡潔にする。`
          );
        } else {
          setError(
            `HTTP ${res.status}：サーバーが JSON 以外を返しました。\n` +
              text.slice(0, 400)
          );
        }
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        let msg = data.error || "生成に失敗しました";
        const d = data.detail;
        // レート制限は専用の説明を先頭に
        if (d?.type === "rate_limit_error" || d?.status === 429) {
          msg =
            "⏱ Anthropic API のレート制限に達しました（30,000 input tokens / 分が上限）。\n\n" +
            "対策：\n" +
            "・1〜2 分待って再試行\n" +
            "・Web 検索を OFF にする（ページ取得で大量のトークンを消費するため）\n" +
            "・Anthropic のプランを Tier 2 以上に上げる → https://console.anthropic.com/settings/limits\n\n" +
            "(元のエラー: " + (data.error || "") + ")";
        } else if (d) {
          const parts: string[] = [];
          if (d.stage) parts.push(`stage: ${d.stage}`);
          if (d.status) parts.push(`status: ${d.status}`);
          if (d.type) parts.push(`type: ${d.type}`);
          if (d.name && d.name !== "Error") parts.push(`name: ${d.name}`);
          if (d.api_error) parts.push(`api: ${JSON.stringify(d.api_error)}`);
          if (d.parse_error) parts.push(`parse: ${d.parse_error}`);
          if (d.elapsed_ms) parts.push(`elapsed: ${d.elapsed_ms}ms`);
          if (parts.length > 0) msg += "\n\n[詳細]\n" + parts.join("\n");
          if (d.raw_preview) msg += "\n\n[LLM 生出力 先頭]\n" + d.raw_preview.slice(0, 600);
          if (d.stack) msg += "\n\n[stack]\n" + d.stack;
        }
        setError(msg);
        console.error("Generate failed:", data);
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(
        `ネットワーク/クライアントエラー: ${e?.message || e}\n` +
          `（接続切れ・タイムアウト・ブラウザの CORS 等の可能性）`
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">
          フィード投稿 構成案ジェネレーター
        </h1>
        <p className="text-sm text-slate-600">
          ネタを入れて 3 軸で絞り込み →
          フォーマットを選ぶと、構成案とタイトル案が自動で出ます。
        </p>
        <p className="text-[10px] text-slate-400">
          {BUILD_ID}（このIDが古いままならハードリフレッシュ Cmd+Shift+R）
        </p>
      </header>

      {/* ========== 参考画像（最上部・目立つ場所に配置） ========== */}
      <section className="bg-amber-50 rounded-lg border-4 border-amber-400 p-5 space-y-3 shadow-md">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold text-lg text-amber-900">
            📷 参考画像（任意・{refImages.length} 枚）
          </h2>
          {refImages.length > 0 && (
            <button
              onClick={() => setRefImages([])}
              className="text-xs text-red-600 hover:underline"
            >
              全て削除
            </button>
          )}
        </div>
        <div className="bg-white border border-amber-200 rounded p-3 text-xs text-slate-700 space-y-1">
          <p className="font-medium">📁 セゾンファンデックス 参考画像フォルダ</p>
          <p>Drive を開いて画像をダウンロード → ここにドラッグ＆ドロップ。</p>
          <a
            href={DRIVE_FOLDER_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-block mt-1 px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700"
          >
            🔗 Google Drive フォルダを開く
          </a>
        </div>
        <div
          className="border-2 border-dashed rounded-lg p-6 text-center border-amber-400 bg-white"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleImageUpload(e.dataTransfer.files);
          }}
        >
          <p className="text-sm text-slate-700 mb-2">
            画像をここにドラッグ＆ドロップ（複数可）
          </p>
          <label className="inline-block px-4 py-1.5 rounded bg-amber-600 text-white text-sm cursor-pointer hover:bg-amber-700">
            ファイルを選択
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />
          </label>
        </div>
        {refImages.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
            {refImages.map((img) => (
              <div
                key={img.id}
                className="relative border border-slate-200 rounded overflow-hidden"
              >
                <img
                  src={img.dataUrl}
                  alt={img.name}
                  className="w-full aspect-square object-cover"
                />
                <select
                  value={img.pattern_id}
                  onChange={(e) =>
                    setRefImages((prev) =>
                      prev.map((i) =>
                        i.id === img.id
                          ? { ...i, pattern_id: e.target.value }
                          : i
                      )
                    )
                  }
                  className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/70 text-white border-0 p-1"
                >
                  {PATTERN_CHOICES.map((g) => (
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
                  onClick={() =>
                    setRefImages((prev) => prev.filter((i) => i.id !== img.id))
                  }
                  className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-600/80 text-white rounded text-[10px] flex items-center justify-center hover:bg-red-700"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ========== Step 1: ネタ入力 ========== */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-lg">Step 1. ネタ入力</h2>
        <label className="block text-sm">
          <span className="block mb-1 font-medium">
            ネタ本文 <span className="text-red-500">*</span>
          </span>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="例：住宅ローンの金利タイプ（変動／固定／ミックス）の選び方"
            rows={3}
            className="w-full border border-slate-300 rounded px-3 py-2"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="block mb-1 font-medium">
              ターゲット（任意）
            </span>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="30〜40代のこれから家を買う人"
              className="w-full border border-slate-300 rounded px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="block mb-1 font-medium">ゴール（任意）</span>
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="保存してもらい検討時に見返してもらう"
              className="w-full border border-slate-300 rounded px-3 py-2"
            />
          </label>
        </div>
      </section>

      {/* ========== Step 2: 3 軸選択 ========== */}
      {axisOptions && (
        <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-lg">
            Step 2. 3 軸で絞り込み（任意・全未選択なら全 20 件から選べます）
          </h2>

          <AxisPicker
            label="フック（1 枚目の入り方）"
            options={axisOptions.hook}
            value={hook}
            onChange={setHook}
          />
          <AxisPicker
            label="トーン"
            options={axisOptions.tone}
            value={tone}
            onChange={setTone}
          />
          <AxisPicker
            label="構造"
            options={axisOptions.structure}
            value={structure}
            onChange={setStructure}
          />
        </section>
      )}

      {/* ========== Step 3: フォーマット候補 ========== */}
      <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-3">
        <h2 className="font-semibold text-lg">Step 3. フォーマットを選ぶ</h2>
        <FormatList
          title={`完全一致（${candidates.exact.length}）`}
          formats={candidates.exact}
          selected={selectedFormatId}
          onSelect={setSelectedFormatId}
          emptyMsg="軸を全て選択すると完全一致候補が出ます"
        />
        <FormatList
          title={`部分一致・その他候補（${candidates.partial.length}）`}
          formats={candidates.partial}
          selected={selectedFormatId}
          onSelect={setSelectedFormatId}
        />
      </section>

      {/* ========== 生成ボタン ========== */}
      <section className="space-y-3">
        <label className="flex items-center gap-2 text-sm bg-white border border-slate-200 rounded-lg p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useWebSearch}
            onChange={(e) => setUseWebSearch(e.target.checked)}
            className="w-4 h-4"
          />
          <span>
            <strong>Web 検索で出典を裏取りする</strong>
            <span className="text-slate-500 text-xs ml-2">
              （ON 推奨。遅くなるが公的ソースの URL が入る）
            </span>
          </span>
        </label>
        <button
          disabled={!topic || !selectedFormatId || generating}
          onClick={() => handleGenerate()}
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          {generating
            ? useWebSearch
              ? "生成中… (Web 検索中・1〜2 分かかります)"
              : "生成中… (数十秒かかります)"
            : !topic
            ? "ネタを入力してください"
            : !selectedFormatId
            ? "フォーマットを選択してください"
            : "構成案を生成"}
        </button>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
            <p className="text-red-700 text-sm whitespace-pre-wrap font-mono text-xs">
              {error}
            </p>
            <div className="mt-2 pt-2 border-t border-red-200 text-xs text-red-600">
              トラブルシュート：
              <a
                href="/api/health"
                target="_blank"
                className="underline mx-1"
                rel="noreferrer"
              >
                /api/health
              </a>
              で環境設定を確認、
              <a
                href="/api/health?ping=1"
                target="_blank"
                className="underline mx-1"
                rel="noreferrer"
              >
                /api/health?ping=1
              </a>
              で Anthropic API の疎通確認。
            </div>
          </div>
        )}
      </section>

      {/* ========== 結果表示 ========== */}
      {result && (
        <ResultView
          result={result}
          refImages={refImages}
          feedbackHistory={feedbackHistory}
          feedbackDraft={feedbackDraft}
          setFeedbackDraft={setFeedbackDraft}
          onRegenerate={(fb) => handleGenerate(fb)}
          onClearFeedback={() => {
            setFeedbackHistory([]);
            setFeedbackDraft("");
          }}
          generating={generating}
        />
      )}
    </main>
  );
}

function AxisPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: AxisOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        <Chip label="指定なし" active={value === ""} onClick={() => onChange("")} />
        {options.map((opt) => (
          <Chip
            key={opt.id}
            label={opt.name}
            detail={opt.example}
            active={value === opt.id}
            onClick={() => onChange(opt.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Chip({
  label,
  detail,
  active,
  onClick,
}: {
  label: string;
  detail?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-sm transition ${
        active
          ? "bg-blue-600 border-blue-600 text-white"
          : "bg-white border-slate-300 text-slate-700 hover:border-blue-400"
      }`}
      title={detail}
    >
      {label}
    </button>
  );
}

function FormatList({
  title,
  formats,
  selected,
  onSelect,
  emptyMsg,
}: {
  title: string;
  formats: FormatSummary[];
  selected: string;
  onSelect: (id: string) => void;
  emptyMsg?: string;
}) {
  return (
    <div>
      <div className="text-sm font-medium mb-2">{title}</div>
      {formats.length === 0 ? (
        <p className="text-slate-400 text-sm">{emptyMsg || "候補なし"}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {formats.map((f) => (
            <button
              key={f.id}
              onClick={() => onSelect(f.id)}
              className={`text-left p-3 border rounded-lg transition ${
                selected === f.id
                  ? "border-blue-600 bg-blue-50 ring-2 ring-blue-200"
                  : "border-slate-200 hover:border-blue-400"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{f.name}</span>
                <span className="text-xs text-slate-500">{f.slides}枚</span>
                {f.enterprise_caution === "caution" && (
                  <span className="text-xs px-1.5 bg-amber-100 text-amber-800 rounded">
                    要注意
                  </span>
                )}
                {f.risk_count > 0 && (
                  <span className="text-xs px-1.5 bg-red-50 text-red-700 rounded">
                    リスク{f.risk_count}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-600">{f.one_liner}</div>
              <div className="text-[10px] text-slate-400 mt-1">
                {f.axes.hook} × {f.axes.tone} × {f.axes.structure}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ResultView({
  result,
  refImages,
  feedbackHistory,
  feedbackDraft,
  setFeedbackDraft,
  onRegenerate,
  onClearFeedback,
  generating,
}: {
  result: GenerateResult;
  refImages: RefImage[];
  feedbackHistory: string[];
  feedbackDraft: string;
  setFeedbackDraft: (s: string) => void;
  onRegenerate: (fb?: string) => void;
  onClearFeedback: () => void;
  generating: boolean;
}) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-5">
      <h2 className="font-semibold text-lg">生成結果</h2>
      <div className="text-sm">
        使用フォーマット: <strong>{result.format.name}</strong>（
        {result.format.id}）
      </div>

      {/* フィードバック積み上げ再生成 */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-amber-900">
            💬 フィードバックで再生成（積み上げ学習）
          </h3>
          {feedbackHistory.length > 0 && (
            <button
              onClick={onClearFeedback}
              className="text-xs text-amber-700 hover:underline"
            >
              FB 履歴をクリア
            </button>
          )}
        </div>
        {feedbackHistory.length > 0 && (
          <div className="bg-white border border-amber-200 rounded p-2 space-y-1">
            <p className="text-[11px] text-amber-800 font-medium">
              適用中の FB ({feedbackHistory.length} 件) — 次回もすべて累積反映
            </p>
            <ol className="text-xs text-slate-700 space-y-0.5 list-decimal list-inside">
              {feedbackHistory.map((f, i) => (
                <li key={i} className="break-words">
                  {f}
                </li>
              ))}
            </ol>
          </div>
        )}
        <textarea
          value={feedbackDraft}
          onChange={(e) => setFeedbackDraft(e.target.value)}
          rows={3}
          placeholder="例: 見出しをもっと短く／チェックリスト項目を 5 つに減らす／写真をより具体的に／キャプションを簡潔に 等"
          className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <button
            onClick={() => onRegenerate(feedbackDraft.trim() || undefined)}
            disabled={generating || !feedbackDraft.trim()}
            className="flex-1 py-2 rounded bg-amber-600 text-white font-medium text-sm disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-amber-700"
          >
            {generating ? "再生成中…" : "📝 この FB を追加して再生成"}
          </button>
          <button
            onClick={() => onRegenerate()}
            disabled={generating || feedbackHistory.length === 0}
            className="px-4 py-2 rounded border border-amber-600 text-amber-700 font-medium text-sm disabled:opacity-40 hover:bg-amber-100"
            title="現在の FB 履歴だけで再生成（追加 FB なし）"
          >
            🔁 同条件で再生成
          </button>
        </div>
      </div>

      {result.source_summary && result.source_summary.total > 0 && (
        <div className="flex items-center gap-3 text-sm bg-slate-50 border border-slate-200 rounded p-3 flex-wrap">
          <span className="font-medium">🔗 出典チェック</span>
          {typeof result.source_summary.preferred === "number" && (
            <span className="text-emerald-900 font-medium">
              ⭐ 自社コラム {result.source_summary.preferred}
            </span>
          )}
          {typeof result.source_summary.official === "number" && (
            <span className="text-blue-700">
              公的 {result.source_summary.official}
            </span>
          )}
          <span className="text-amber-700">要確認 {result.source_summary.warn}</span>
          <span className="text-red-700">NG {result.source_summary.block}</span>
          <span className="text-slate-500 text-xs">
            / 合計 {result.source_summary.total} 件
          </span>
        </div>
      )}

      {result.web_search && result.web_search.used && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          <div className="font-medium text-blue-900 mb-1">
            🔍 Web 検索履歴（{(result.web_search.queries || []).length} 回検索 /{" "}
            {result.web_search.result_count || 0} 件ヒット）
          </div>
          {(result.web_search.queries || []).length > 0 ? (
            <ul className="list-disc list-inside text-xs text-blue-800 space-y-0.5">
              {(result.web_search.queries || []).map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-blue-800">
              Web 検索は実行されませんでした（出典不要と判断された可能性）
            </p>
          )}
        </div>
      )}

      <div>
        <h3 className="font-medium mb-2">■ タイトル案 3 パターン</h3>
        <div className="space-y-2 text-sm">
          {(result.titles || []).map((t, i) => {
            const isObj = typeof t === "object" && t !== null;
            const item = isObj ? (t as TitleItem) : ({ text: t as string } as TitleItem);
            const label =
              item.approach ||
              (item.tone === "positive"
                ? "ポジ"
                : item.tone === "neutral"
                ? "中立"
                : item.tone === "negative"
                ? "注意喚起"
                : `案${i + 1}`);
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="inline-block px-2 py-0.5 text-[11px] rounded bg-blue-50 text-blue-800 border border-blue-200 shrink-0 mt-0.5">
                  {label}
                </span>
                <span className="flex-1">{item.text}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">
            ■ スライド構成（全 {(result.slides || []).length} 枚）
          </h3>
          <CopyAllCitationsButton slides={result.slides || []} />
        </div>
        <div className="space-y-4">
          {(result.slides || []).map((s) => (
            <SlideCard key={s.index} slide={s} refImages={refImages} />
          ))}
        </div>
      </div>

      {(result.caption_outline || []).length > 0 && (
        <div>
          <h3 className="font-medium mb-2">■ キャプション概要</h3>
          <ul className="text-sm list-disc list-inside space-y-0.5 text-slate-700">
            {(result.caption_outline || []).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {(result.risk_notes || []).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <h3 className="font-medium mb-2 text-amber-900">
            ⚠ 要確認（リスクフラグ）
          </h3>
          <ul className="text-sm space-y-1 text-amber-900">
            {(result.risk_notes || []).map((r, i) => (
              <li key={i}>
                <strong>{r.rule_id}</strong>: {r.note}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SlideCard({
  slide: s,
  refImages,
}: {
  slide: Slide;
  refImages: RefImage[];
}) {
  // このスライドの pattern に対応する参考画像を抽出
  const matchedRefs = s.pattern
    ? refImages.filter((r) => r.pattern_id === s.pattern!.id)
    : [];
  return (
    <div className="border border-slate-200 rounded-lg p-3 text-sm">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
          {s.index}
        </span>
        <span className="font-semibold">{s.role}</span>
        <span className="text-xs text-slate-500">{s.template_id}</span>
        {s.pattern && (
          <span
            className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200"
            title={s.pattern.summary}
          >
            📐 {s.pattern.id} {s.pattern.name}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)] gap-4">
        {/* 左：完成イメージ（正方形 SVG プレビュー） + 参考画像 */}
        <div className="space-y-2">
          <div className="flex gap-2 items-start flex-wrap">
            {s.svg && (
              <div className="space-y-1">
                <div
                  className="w-[200px] aspect-square border-2 border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm"
                  dangerouslySetInnerHTML={{ __html: s.svg }}
                />
                <p className="text-[10px] text-slate-400 text-center">
                  プレビュー（SVG）
                </p>
              </div>
            )}
            {matchedRefs.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1 flex-wrap max-w-[220px]">
                  {matchedRefs.slice(0, 4).map((ref) => (
                    <div
                      key={ref.id}
                      className="w-[100px] aspect-square border-2 border-blue-300 rounded overflow-hidden"
                    >
                      <img
                        src={ref.dataUrl}
                        alt={ref.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-blue-600 text-center">
                  📎 参考画像（{s.pattern!.id}）
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <Zone label="上" data={s.zone_top} />
            <Zone label="中" data={s.zone_middle} />
            <Zone label="下" data={s.zone_bottom} />
          </div>
          {s.photo_hint && (
            <div className="text-xs text-slate-600">
              📷 写真: {s.photo_hint}
            </div>
          )}
          {s.diagram && (
            <div className="text-xs text-slate-600">
              📊 図解: {s.diagram_info?.name || s.diagram}
              {s.diagram_info?.category && (
                <span className="text-slate-400 ml-1">
                  （{s.diagram_info.category}）
                </span>
              )}
            </div>
          )}
          {s.diagram_info?.ascii_preview && (
            <pre className="mt-1 bg-slate-50 border border-slate-200 rounded p-2 text-[11px] leading-[1.3] font-mono overflow-x-auto whitespace-pre">
{s.diagram_info.ascii_preview}
            </pre>
          )}
          {s.canva_search_url && (
            <a
              href={s.canva_search_url}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-blue-700 hover:underline"
            >
              🎨 Canva で近いテンプレを検索 →
            </a>
          )}
          {s.notes && (
            <div className="text-xs text-slate-400">{s.notes}</div>
          )}
        </div>

        {/* 右：出典 */}
        <div>
          <SourcesPanel slide={s} />
        </div>
      </div>
    </div>
  );
}

function SourcesPanel({ slide }: { slide: Slide }) {
  const cites = slide.sources || [];
  if (cites.length === 0) {
    return (
      <div className="text-xs text-slate-400 border border-dashed border-slate-200 rounded p-3 h-full">
        このスライドに出典なし
      </div>
    );
  }
  return (
    <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2 h-full">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-700">
          🔗 出典 ({cites.length})
        </span>
        <CopySlideCitationsButton slide={slide} />
      </div>
      <div className="space-y-2">
        {cites.map((src, i) => (
          <CitationRow key={i} c={src} />
        ))}
      </div>
    </div>
  );
}

function CopySlideCitationsButton({ slide }: { slide: Slide }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    const text = formatSlideCitationsClient(slide);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // フォールバック：選択可能な領域に表示
      window.prompt("コピーしてください", text);
    }
  };
  return (
    <button
      onClick={handle}
      className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
      title="このスライドの出典を Canva コメント貼付け用テキストとしてコピー"
    >
      {copied ? "✅ コピー済" : "📋 Canva 用にコピー"}
    </button>
  );
}

function CopyAllCitationsButton({ slides }: { slides: Slide[] }) {
  const [copied, setCopied] = useState(false);
  const total = slides.reduce((acc, s) => acc + (s.sources?.length || 0), 0);
  const handle = async () => {
    const text = formatAllCitationsClient(slides);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("コピーしてください", text);
    }
  };
  if (total === 0) return null;
  return (
    <button
      onClick={handle}
      className="text-xs px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
      title="全スライドの出典をまとめて Canva コメント用テキストとしてコピー"
    >
      {copied ? "✅ コピー済" : `📋 全出典をコピー (${total} 件)`}
    </button>
  );
}

// クライアント側用の整形（lib/citation-format.ts と同じロジック）
function formatSlideCitationsClient(slide: Slide): string {
  const cites = slide.sources || [];
  if (cites.length === 0) return "";
  const header = `【参照元】Slide ${slide.index} ${slide.role}`;
  const body = cites
    .map((c, i) => {
      const lines: string[] = [];
      lines.push(`${i + 1}. ${c.title || "（タイトル未取得）"}`);
      if (c.page_or_section) lines.push(`   セクション: ${c.page_or_section}`);
      lines.push(`   URL: ${c.url}`);
      if (c.quote) lines.push(`   引用: 「${c.quote}」`);
      return lines.join("\n");
    })
    .join("\n\n");
  return `${header}\n${body}`;
}

function formatAllCitationsClient(slides: Slide[]): string {
  const blocks = slides
    .filter((s) => (s.sources || []).length > 0)
    .map((s) => formatSlideCitationsClient(s));
  if (blocks.length === 0) return "";
  return ["【参照元一覧】", ...blocks].join("\n\n────────\n\n");
}

function CitationRow({ c }: { c: VerifiedCitation }) {
  const v = c.verdict;
  const color =
    v.classification === "preferred"
      ? "text-emerald-900 bg-emerald-100 border-emerald-300 font-medium"
      : v.severity === "ok"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : v.severity === "warn"
      ? "text-amber-800 bg-amber-50 border-amber-200"
      : "text-red-700 bg-red-50 border-red-200";
  const label =
    v.classification === "preferred"
      ? "⭐ 自社コラム"
      : v.classification === "official"
      ? "公的"
      : v.classification === "corporate_trusted"
      ? "信頼企業"
      : v.classification === "corporate_unknown"
      ? "企業・要確認"
      : v.classification === "personal_blog"
      ? "NG（個人ブログ）"
      : "URL 不正";
  return (
    <div className="text-xs space-y-0.5 pl-2 border-l-2 border-slate-200">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-block px-1.5 py-0.5 text-[10px] rounded border ${color}`}>
          {label}
        </span>
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className="text-blue-700 hover:underline break-all"
        >
          {c.url}
        </a>
      </div>
      {c.title && <div className="text-slate-700">📄 {c.title}</div>}
      {c.page_or_section && (
        <div className="text-slate-600">📍 {c.page_or_section}</div>
      )}
      {c.quote && (
        <div className="text-slate-500 italic">「{c.quote}」</div>
      )}
      {v.severity !== "ok" && (
        <div className="text-[11px] text-slate-500">{v.reason}</div>
      )}
    </div>
  );
}

function Zone({ label, data }: { label: string; data: any }) {
  if (!data) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-400 w-6 shrink-0">{label}</span>
      <span className="text-slate-500 w-28 shrink-0 font-mono">
        {data.element || "-"}
      </span>
      <span className="flex-1">{data.content || "-"}</span>
    </div>
  );
}
