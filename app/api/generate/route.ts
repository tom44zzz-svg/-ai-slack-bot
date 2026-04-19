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
        max_tokens: 8192,
        // 注意：以前 cache_control を付けていたが、web_search のツール結果が
        // 空テキストブロックを生成するケースで Anthropic 側が
        // "cache_control cannot be set for empty text blocks" を返したため除去。
        system,
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

    // JSON を抽出：以下の優先順で試みる
    //   1. 閉じた ```json ... ``` ブロック
    //   2. 開いた ```json ... （末尾切れ） → ``` 以降の内容を採用
    //   3. 最初の '{' からテキスト末尾まで（プリアンブルを除去）
    let parsed: any = null;
    let jsonText = rawText;
    const fenced = rawText.match(/```json\s*([\s\S]*?)```/);
    if (fenced) {
      jsonText = fenced[1];
    } else {
      // 未閉じのフェンス
      const openFence = rawText.match(/```json\s*([\s\S]*)$/);
      if (openFence) {
        jsonText = openFence[1];
      } else {
        // フェンスなし：最初の '{' 以降
        const first = rawText.indexOf("{");
        if (first >= 0) {
          jsonText = rawText.slice(first);
        }
      }
    }
    jsonText = jsonText.trim();

    // トランケーション自動修復：max_tokens で途中で切れた JSON を救う。
    // 戦略：文字を舐めて括弧のスタックを追い、最後に「安全にカットして
    // 閉じられる位置」を記憶 → 末尾を切って閉じ括弧を補完する。
    function repairTruncatedJson(text: string): string {
      let t = text.trim().replace(/```\s*$/, "").trim();

      let lastSafe = -1; // これまで見た「要素終わり（, の直前 or 配列末端）」
      const stack: string[] = [];
      let inString = false;
      let escape = false;

      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (c === "\\") {
          escape = true;
          continue;
        }
        if (c === '"') {
          inString = !inString;
          // 文字列が閉じた直後、浅い位置なら安全点更新
          if (!inString && stack.length <= 1) lastSafe = i;
          continue;
        }
        if (inString) continue;

        if (c === "{" || c === "[") {
          stack.push(c);
        } else if (c === "}" || c === "]") {
          stack.pop();
          // 浅い位置で閉じたら安全点更新
          if (stack.length <= 1) lastSafe = i;
        } else if (c === "," && stack.length <= 2) {
          // カンマ前の "}" か "]" までを安全点として記憶（配列の要素境界）
          lastSafe = i - 1;
        }
      }

      // 問題なし（完結している）ならそのまま
      if (!inString && stack.length === 0) return t;

      // 途中切れ → lastSafe までに切り詰めて、開いた括弧を閉じる
      if (lastSafe > 0) {
        t = t.slice(0, lastSafe + 1);
      }

      // 切り詰めた後のスタック再構築
      const newStack: string[] = [];
      let ns = false;
      let ne = false;
      for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (ne) {
          ne = false;
          continue;
        }
        if (c === "\\") {
          ne = true;
          continue;
        }
        if (c === '"') {
          ns = !ns;
          continue;
        }
        if (ns) continue;
        if (c === "{" || c === "[") newStack.push(c);
        else if (c === "}" || c === "]") newStack.pop();
      }
      while (newStack.length) {
        const open = newStack.pop();
        t += open === "{" ? "}" : "]";
      }

      // 末尾カンマ除去
      t = t.replace(/,\s*([}\]])/g, "$1");
      return t;
    }

    try {
      parsed = JSON.parse(jsonText);
    } catch (e: any) {
      // 1 回目失敗：トランケーション修復を試みる
      try {
        const repaired = repairTruncatedJson(jsonText);
        parsed = JSON.parse(repaired);
        console.warn(
          "[api/generate] JSON was truncated but repaired successfully"
        );
      } catch (e2: any) {
        console.error("[api/generate] json parse failed", {
          raw_preview: rawText.slice(0, 500),
          parse_error: e?.message,
          repair_error: e2?.message,
        });
        return NextResponse.json(
          {
            error:
              "LLM 応答の JSON パースに失敗しました（トランケーション修復も失敗）",
            detail: {
              stage: "json_parse",
              parse_error: e?.message,
              repair_error: e2?.message,
              raw_preview: rawText.slice(0, 3000),
            raw_length: rawText.length,
            json_extracted_preview: jsonText.slice(0, 1500),
            json_extracted_length: jsonText.length,
              elapsed_ms: elapsedGen,
            },
          },
          { status: 502 }
        );
      }
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

    // 空ゾーン検証：上または下のテキストが空のスライドを検出
    const emptySlides = slides
      .filter((s: any) => {
        const isCta = s.role === "CTA";
        if (isCta) return false;
        const topEmpty =
          !s.zone_top?.content || String(s.zone_top.content).trim() === "" ||
          String(s.zone_top.content).trim() === "-";
        const botEmpty =
          !s.zone_bottom?.content || String(s.zone_bottom.content).trim() === "" ||
          String(s.zone_bottom.content).trim() === "-";
        const hasMiddleVisual =
          s.zone_middle?.element === "photo" ||
          s.zone_middle?.element === "diagram" ||
          s.zone_middle?.element === "illustration_single";
        // 写真／図解スライドで上下とも空 = NG
        return hasMiddleVisual && (topEmpty || botEmpty);
      })
      .map((s: any) => s.index);

    // ブロック級違反を risk_notes に自動追加
    const riskNotes = [...(parsed.risk_notes || [])];
    if (emptySlides.length > 0) {
      riskNotes.push({
        rule_id: "empty_zone",
        note: `スライド ${emptySlides.join(", ")} の上または下のテキストが空です。写真／図解だけのスライドは過去投稿のスタイルに反します。手動で見出し or キャプションを追加してください。`,
      });
    }
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
