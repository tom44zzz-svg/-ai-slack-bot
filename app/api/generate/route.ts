import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadAll } from "@/lib/data-loader";
import { buildPrompt } from "@/lib/prompt";
import { verifyCitations } from "@/lib/sources";
import { getCanvaSearchUrl } from "@/lib/canva";
import { renderSlideSvg } from "@/lib/svg-render";

// web_search tool でブロックする個人ブログ系ドメイン
const BLOCKED_SEARCH_DOMAINS = [
  "ameblo.jp",
  "note.com",
  "hatenablog.com",
  "hatenablog.jp",
  "blog.livedoor.jp",
  "blog.goo.ne.jp",
  "fc2.com",
  "seesaa.net",
  "medium.com",
  "wordpress.com",
  "blogger.com",
  "qiita.com",
  "zenn.dev",
];

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      topic,
      target,
      goal,
      format_id,
      use_web_search = true,
      feedback_history = [],
    } = body;

    if (!topic || !format_id) {
      return NextResponse.json(
        { error: "topic と format_id は必須です" },
        { status: 400 }
      );
    }

    const { formats, templates, rules, cta_patterns, diagrams, page_patterns } =
      loadAll();
    const format = formats.find((f) => f.id === format_id);
    if (!format) {
      return NextResponse.json(
        { error: `format_id が見つかりません: ${format_id}` },
        { status: 404 }
      );
    }

    const { system, user } = buildPrompt({
      topic,
      target,
      goal,
      format,
      templates,
      rules,
      useWebSearch: use_web_search,
      feedbackHistory: Array.isArray(feedback_history) ? feedback_history : [],
      pagePatterns: page_patterns,
    });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "ANTHROPIC_API_KEY が未設定です。.env.local を作成して ANTHROPIC_API_KEY=sk-... を設定してください。",
        },
        { status: 500 }
      );
    }

    const client = new Anthropic({ apiKey });

    // web_search ツール（Anthropic 提供のサーバーサイドツール）
    // max_uses は Tier 1 の 30k tokens/min を超えないよう控えめに。
    const tools: any[] = use_web_search
      ? [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 2,
            blocked_domains: BLOCKED_SEARCH_DOMAINS,
          },
        ]
      : [];

    let response: any;
    const t0 = Date.now();
    try {
      response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        // system プロンプトをキャッシュすることで、後続リクエストの
        // 入力トークン課金を大幅削減。
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ] as any,
        messages: [{ role: "user", content: user }],
        ...(tools.length > 0 ? { tools } : {}),
      });
    } catch (err: any) {
      // Anthropic のエラーをできるだけ詳細に返す
      const detail = {
        stage: "anthropic_api_call",
        elapsed_ms: Date.now() - t0,
        name: err?.name || "Error",
        message: err?.message || String(err),
        status: err?.status,
        type: err?.error?.type,
        api_error: err?.error?.message || err?.error || null,
        request_id: err?.request_id,
        use_web_search,
      };
      console.error("[api/generate] anthropic error", detail);
      return NextResponse.json(
        { error: detail.message, detail },
        { status: err?.status || 502 }
      );
    }
    const elapsedGen = Date.now() - t0;

    // 全 text ブロックを連結（web_search を使った場合、tool_use / tool_result
    // ブロックの合間に最終回答 text が分散することがある）
    const rawText = response.content
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text || "")
      .join("\n");

    // web_search を使った場合の検索履歴を集計
    const searchQueries: string[] = [];
    const searchResultUrls: Array<{ url: string; title?: string }> = [];
    for (const block of response.content as any[]) {
      if (block.type === "server_tool_use" && block.name === "web_search") {
        const q = block.input?.query;
        if (q) searchQueries.push(q);
      }
      if (block.type === "web_search_tool_result") {
        const results = block.content || [];
        for (const r of results) {
          if (r.type === "web_search_result" && r.url) {
            searchResultUrls.push({ url: r.url, title: r.title });
          }
        }
      }
    }

    // JSON を抽出（コードフェンス内 or 直 JSON の両方を許容）
    let parsed: any = null;
    const fenced = rawText.match(/```json\s*([\s\S]*?)```/);
    // フェンスなしでも最初の { から最後の } までを抽出
    let jsonText = fenced ? fenced[1] : rawText;
    if (!fenced) {
      const first = rawText.indexOf("{");
      const last = rawText.lastIndexOf("}");
      if (first >= 0 && last > first) {
        jsonText = rawText.slice(first, last + 1);
      }
    }
    try {
      parsed = JSON.parse(jsonText.trim());
    } catch (e: any) {
      console.error("[api/generate] json parse failed", {
        raw_preview: rawText.slice(0, 500),
        parse_error: e?.message,
      });
      return NextResponse.json(
        {
          error: "LLM 応答の JSON パースに失敗しました",
          detail: {
            stage: "json_parse",
            parse_error: e?.message,
            raw_preview: rawText.slice(0, 1500),
            elapsed_ms: elapsedGen,
          },
        },
        { status: 502 }
      );
    }

    // 各スライドの出典を検証 + 図解プレビュー + Canva 検索 URL を付与 + ページパターン推定
    const diagramById = new Map(diagrams.map((d: any) => [d.id, d]));
    // template_id → 該当 PagePattern[]
    const patternsByTpl = new Map<string, any[]>();
    for (const p of page_patterns) {
      for (const tid of p.template_ids || []) {
        if (!patternsByTpl.has(tid)) patternsByTpl.set(tid, []);
        patternsByTpl.get(tid)!.push(p);
      }
    }
    const patternById = new Map(page_patterns.map((p: any) => [p.id, p]));
    const slides = (parsed.slides || []).map((s: any) => {
      const verified = verifyCitations(s.sources || []);
      const diagramInfo = s.diagram ? diagramById.get(s.diagram) : undefined;
      const matchedPatterns = patternsByTpl.get(s.template_id) || [];
      // LLM が明示的に pattern_id を返したらそれを優先、
      // 返さなかった場合は template_id からマッチした先頭を使う
      const mainPattern =
        (s.pattern_id && patternById.get(s.pattern_id)) || matchedPatterns[0];
      return {
        ...s,
        sources: verified,
        diagram_info: diagramInfo
          ? {
              id: diagramInfo.id,
              name: diagramInfo.name,
              category: diagramInfo.category,
              ascii_preview: diagramInfo.ascii_preview,
              use_case: diagramInfo.use_case,
            }
          : null,
        pattern: mainPattern
          ? {
              id: mainPattern.id,
              name: mainPattern.name,
              role: mainPattern.role,
              summary: mainPattern.summary,
              based_on: mainPattern.based_on || [],
            }
          : null,
        canva_search_url: getCanvaSearchUrl({
          diagram: s.diagram,
          role: s.role,
        }),
      };
    });

    // 全出典を集計
    const allCitations = slides.flatMap((s: any) => s.sources || []);
    const sourceSummary = {
      total: allCitations.length,
      preferred: allCitations.filter(
        (c: any) => c.verdict.classification === "preferred"
      ).length,
      official: allCitations.filter(
        (c: any) => c.verdict.classification === "official"
      ).length,
      ok: allCitations.filter((c: any) => c.verdict.severity === "ok").length,
      warn: allCitations.filter((c: any) => c.verdict.severity === "warn").length,
      block: allCitations.filter((c: any) => c.verdict.severity === "block").length,
    };

    // ブロック級違反を risk_notes に自動追加
    const riskNotes = [...(parsed.risk_notes || [])];
    if (sourceSummary.block > 0) {
      riskNotes.push({
        rule_id: "rule_03_source",
        note: `個人ブログ等の NG ドメインが ${sourceSummary.block} 件検出されました。該当 URL を公的ソースに差し替えてください。`,
      });
    }
    if (sourceSummary.warn > 0) {
      riskNotes.push({
        rule_id: "rule_03_source",
        note: `企業ドメインとして未登録のソースが ${sourceSummary.warn} 件あります。公的ソースか確認してください。`,
      });
    }
    if (sourceSummary.total > 0 && sourceSummary.preferred === 0) {
      riskNotes.push({
        rule_id: "fundex_coverage",
        note: "セゾンファンデックス自社コラム（fundex.co.jp/contents/）のカバレッジがありません。将来のコラム化候補として記録を推奨。",
      });
    }

    // CTA スライドを固定追加
    const ctaSlide = {
      index: slides.length + 1,
      role: "CTA",
      template_id: "tpl_cta_phone",
      zone_top: { element: "heading", content: "不動産やお金に関するお役立ち情報を発信中！" },
      zone_middle: {
        element: "phone_mockup",
        content: "Instagram プロフィール画面 + 黄色アクセントの『フォローして最新情報を GET！』",
      },
      zone_bottom: {
        element: "caption",
        content: "いつでも見返せるように保存！",
      },
      photo_hint: null,
      diagram: null,
      diagram_info: null,
      sources: [],
      canva_search_url: getCanvaSearchUrl({ role: "CTA" }),
      notes: "CTA 固定（cta_follow + cta_save の default_combination）",
    };

    // 最終スライドリスト（CTA 含む）を作って、SVG を各スライドに埋める
    const finalSlides = [...slides, ctaSlide];
    const totalCount = finalSlides.length;
    const slidesWithSvg = finalSlides.map((s: any) => ({
      ...s,
      svg: renderSlideSvg(s, totalCount),
    }));

    return NextResponse.json({
      format: {
        id: format.id,
        name: format.name,
        axes: format.axes,
      },
      titles: parsed.titles || [],
      slides: slidesWithSvg,
      caption_outline: parsed.caption_outline || [],
      risk_notes: riskNotes,
      source_summary: sourceSummary,
      web_search: {
        used: use_web_search,
        queries: searchQueries,
        result_count: searchResultUrls.length,
      },
      cta_default: cta_patterns
        .filter((c) => c.default)
        .map((c) => c.copy_options[0]),
    });
  } catch (err: any) {
    console.error("[api/generate] unhandled", err);
    return NextResponse.json(
      {
        error: err?.message || "内部エラーが発生しました",
        detail: {
          stage: "unhandled",
          name: err?.name,
          stack: err?.stack?.split("\n").slice(0, 5).join("\n"),
        },
      },
      { status: 500 }
    );
  }
}
