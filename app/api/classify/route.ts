import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadAll } from "@/lib/data-loader";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * 画像をひとつ受け取り、page-patterns.yaml の中から
 * 最も当てはまる pattern_id を返す。
 *
 * POST body: { dataUrl: "data:image/jpeg;base64,..." }
 * Response:  { pattern_id: "P20", reason: "..." }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { dataUrl } = body;
    if (!dataUrl || typeof dataUrl !== "string") {
      return NextResponse.json(
        { error: "dataUrl が必要です" },
        { status: 400 }
      );
    }

    // base64 とメディアタイプを分解
    const m = dataUrl.match(/^data:(image\/[a-z]+);base64,(.*)$/);
    if (!m) {
      return NextResponse.json(
        { error: "dataUrl の形式が不正です（data:image/...;base64,... 形式が必要）" },
        { status: 400 }
      );
    }
    const mediaType = m[1];
    const base64 = m[2];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY が未設定です" },
        { status: 500 }
      );
    }

    const { page_patterns } = loadAll();

    // pattern 一覧を簡潔に提示
    const patternList = page_patterns
      .map(
        (p: any) =>
          `- ${p.id} (${p.role}) ${p.name}: ${p.summary}`
      )
      .join("\n");

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: `あなたは Instagram のフィード投稿スライドを見て、その構造的パターンを判定する分類器です。
以下のパターン候補から、画像のスライドが**最も当てはまるもの**を 1 つ選び、JSON で返してください。

# パターン一覧
${patternList}

# 判定ガイド
- 表紙：1枚目に該当する大きな見出しと写真／背景
- 導入：問題提起、引用、比較表で本論へ誘導
- 項目：番号バッジ＋本文＋図解／写真。図解の種類で細分化
- まとめ：チェックリスト再掲、ケース別推薦
- CTA：フォロー誘導、スマホUI、家族イラスト等

# 出力形式（厳密に JSON のみ）
{"pattern_id": "P20", "reason": "10〜30字の判定理由"}`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            } as any,
            {
              type: "text",
              text: "このスライド画像のパターンを判定してください。JSON のみで返答。",
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find(
      (b: any) => b.type === "text"
    ) as any;
    const raw = textBlock?.text || "";

    // JSON 抽出
    let parsed: any = null;
    try {
      const fenced = raw.match(/```json\s*([\s\S]*?)```/);
      const jsonText = fenced ? fenced[1] : raw;
      const first = jsonText.indexOf("{");
      const last = jsonText.lastIndexOf("}");
      const slice = first >= 0 && last > first ? jsonText.slice(first, last + 1) : jsonText;
      parsed = JSON.parse(slice.trim());
    } catch {
      return NextResponse.json(
        { error: "LLM 応答の JSON パースに失敗", raw },
        { status: 502 }
      );
    }

    const validIds = new Set(page_patterns.map((p: any) => p.id));
    if (!validIds.has(parsed.pattern_id)) {
      return NextResponse.json(
        {
          error: `不明な pattern_id: ${parsed.pattern_id}`,
          raw,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      pattern_id: parsed.pattern_id,
      reason: parsed.reason || "",
    });
  } catch (err: any) {
    console.error("[api/classify]", err);
    return NextResponse.json(
      {
        error: err?.message || "内部エラー",
        detail: {
          status: err?.status,
          type: err?.error?.type,
          api_error: err?.error?.message,
        },
      },
      { status: 500 }
    );
  }
}
