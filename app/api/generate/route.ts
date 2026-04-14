import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadAll } from "@/lib/data-loader";
import { buildPrompt } from "@/lib/prompt";
import { verifyCitations } from "@/lib/sources";
import { getCanvaSearchUrl } from "@/lib/canva";

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
    const { topic, target, goal, format_id, use_web_search = true } = body;

    if (!topic || !format_id) {
      return NextResponse.json(
        { error: "topic と format_id は必須です" },
        { status: 400 }
      );
    }

    const { formats, templates, rules, cta_patterns, diagrams } = loadAll();
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
    const tools: any[] = use_web_search
      ? [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 6,
            blocked_domains: BLOCKED_SEARCH_DOMAINS,
          },
        ]
      : [];

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: user }],
      ...(tools.length > 0 ? { tools } : {}),
    });

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
    const jsonText = fenced ? fenced[1] : rawText;
    try {
      parsed = JSON.parse(jsonText.trim());
    } catch (e) {
      return NextResponse.json(
        {
          error: "LLM 応答の JSON パースに失敗しました",
          raw: rawText,
        },
        { status: 502 }
      );
    }

    // 各スライドの出典を検証 + 図解プレビュー + Canva 検索 URL を付与
    const diagramById = new Map(diagrams.map((d: any) => [d.id, d]));
    const slides = (parsed.slides || []).map((s: any) => {
      const verified = verifyCitations(s.sources || []);
      const diagramInfo = s.diagram ? diagramById.get(s.diagram) : undefined;
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

    return NextResponse.json({
      format: {
        id: format.id,
        name: format.name,
        axes: format.axes,
      },
      titles: parsed.titles || [],
      slides: [...slides, ctaSlide],
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
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "内部エラーが発生しました" },
      { status: 500 }
    );
  }
}
