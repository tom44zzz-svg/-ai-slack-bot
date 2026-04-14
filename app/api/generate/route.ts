import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadAll } from "@/lib/data-loader";
import { buildPrompt } from "@/lib/prompt";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { topic, target, goal, format_id } = body;

    if (!topic || !format_id) {
      return NextResponse.json(
        { error: "topic と format_id は必須です" },
        { status: 400 }
      );
    }

    const { formats, templates, rules, cta_patterns } = loadAll();
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

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: user }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock && textBlock.type === "text" ? textBlock.text : "";

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

    // CTA スライドを固定追加
    const ctaSlide = {
      index: (parsed.slides?.length || 0) + 1,
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
      notes: "CTA 固定（cta_follow + cta_save の default_combination）",
    };

    return NextResponse.json({
      format: {
        id: format.id,
        name: format.name,
        axes: format.axes,
      },
      titles: parsed.titles || [],
      slides: [...(parsed.slides || []), ctaSlide],
      caption_outline: parsed.caption_outline || [],
      risk_notes: parsed.risk_notes || [],
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
