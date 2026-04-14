"use client";

import { useEffect, useState } from "react";

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
    | "official"
    | "corporate_trusted"
    | "corporate_unknown"
    | "personal_blog"
    | "invalid";
  severity: "ok" | "warn" | "block";
  reason: string;
};
type VerifiedCitation = {
  url: string;
  title?: string;
  page_or_section?: string;
  quote?: string;
  verdict: SourceVerdict;
};
type Slide = {
  index: number;
  role: string;
  template_id: string;
  zone_top: any;
  zone_middle: any;
  zone_bottom: any;
  photo_hint: string | null;
  diagram: string | null;
  sources?: VerifiedCitation[];
  notes?: string;
};

type GenerateResult = {
  format: { id: string; name: string; axes: any };
  titles: string[];
  slides: Slide[];
  caption_outline: string[];
  risk_notes: Array<{ rule_id: string; note: string }>;
  source_summary?: { total: number; ok: number; warn: number; block: number };
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

  useEffect(() => {
    fetchFormats();
  }, [hook, tone, structure]);

  async function fetchFormats() {
    const params = new URLSearchParams();
    if (hook) params.set("hook", hook);
    if (tone) params.set("tone", tone);
    if (structure) params.set("structure", structure);
    const res = await fetch(`/api/formats?${params}`);
    const data = await res.json();
    if (!axisOptions) setAxisOptions(data.axis_options);
    setCandidates({ exact: data.exact, partial: data.partial });
  }

  async function handleGenerate() {
    if (!topic || !selectedFormatId) return;
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "生成に失敗しました");
        if (data.raw) console.error("Raw LLM output:", data.raw);
      } else {
        setResult(data);
      }
    } catch (e: any) {
      setError(e?.message || "ネットワークエラー");
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
      </header>

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
          onClick={handleGenerate}
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
          <p className="text-red-600 text-sm mt-2 whitespace-pre-wrap">
            {error}
          </p>
        )}
      </section>

      {/* ========== 結果表示 ========== */}
      {result && <ResultView result={result} />}
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

function ResultView({ result }: { result: GenerateResult }) {
  return (
    <section className="bg-white rounded-lg border border-slate-200 p-5 space-y-5">
      <h2 className="font-semibold text-lg">生成結果</h2>
      <div className="text-sm">
        使用フォーマット: <strong>{result.format.name}</strong>（
        {result.format.id}）
      </div>

      {result.source_summary && result.source_summary.total > 0 && (
        <div className="flex items-center gap-3 text-sm bg-slate-50 border border-slate-200 rounded p-3 flex-wrap">
          <span className="font-medium">🔗 出典チェック</span>
          <span className="text-emerald-700">公的/信頼 {result.source_summary.ok}</span>
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
            🔍 Web 検索履歴（{result.web_search.queries.length} 回検索 /{" "}
            {result.web_search.result_count} 件ヒット）
          </div>
          {result.web_search.queries.length > 0 ? (
            <ul className="list-disc list-inside text-xs text-blue-800 space-y-0.5">
              {result.web_search.queries.map((q, i) => (
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
        <h3 className="font-medium mb-2">■ タイトル案 3 つ</h3>
        <ol className="space-y-1 list-decimal list-inside text-sm">
          {result.titles.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="font-medium mb-2">
          ■ スライド構成（全 {result.slides.length} 枚）
        </h3>
        <div className="space-y-3">
          {result.slides.map((s) => (
            <div
              key={s.index}
              className="border border-slate-200 rounded p-3 text-sm space-y-1"
            >
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded">
                  {s.index}
                </span>
                <span className="font-semibold">{s.role}</span>
                <span className="text-xs text-slate-500">
                  {s.template_id}
                </span>
              </div>
              <Zone label="上" data={s.zone_top} />
              <Zone label="中" data={s.zone_middle} />
              <Zone label="下" data={s.zone_bottom} />
              {s.photo_hint && (
                <div className="text-xs text-slate-600">
                  📷 写真: {s.photo_hint}
                </div>
              )}
              {s.diagram && (
                <div className="text-xs text-slate-600">
                  📊 図解: {s.diagram}
                </div>
              )}
              {s.sources && s.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                  <div className="text-xs font-medium text-slate-700">
                    🔗 出典
                  </div>
                  {s.sources.map((src, i) => (
                    <CitationRow key={i} c={src} />
                  ))}
                </div>
              )}
              {s.notes && (
                <div className="text-xs text-slate-400">{s.notes}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {result.caption_outline.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">■ キャプション概要</h3>
          <ul className="text-sm list-disc list-inside space-y-0.5 text-slate-700">
            {result.caption_outline.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {result.risk_notes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3">
          <h3 className="font-medium mb-2 text-amber-900">
            ⚠ 要確認（リスクフラグ）
          </h3>
          <ul className="text-sm space-y-1 text-amber-900">
            {result.risk_notes.map((r, i) => (
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

function CitationRow({ c }: { c: VerifiedCitation }) {
  const v = c.verdict;
  const color =
    v.severity === "ok"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : v.severity === "warn"
      ? "text-amber-800 bg-amber-50 border-amber-200"
      : "text-red-700 bg-red-50 border-red-200";
  const label =
    v.classification === "official"
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
