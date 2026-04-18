import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

/**
 * 環境・API キー・Anthropic 疎通を確認するヘルスチェック。
 * 本番デプロイ直後の動作確認・トラブルシュート用。
 *
 * GET /api/health            … 環境変数と SDK ロードを確認（API 呼び出しなし）
 * GET /api/health?ping=1     … Anthropic に最小トークンで ping
 */
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ping = searchParams.get("ping") === "1";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const hasKey = Boolean(apiKey);
  const keyPrefix = apiKey ? apiKey.slice(0, 12) + "..." : null;

  const base: any = {
    env: {
      has_anthropic_api_key: hasKey,
      anthropic_api_key_prefix: keyPrefix,
      node_env: process.env.NODE_ENV || "unknown",
      vercel: Boolean(process.env.VERCEL),
      vercel_env: process.env.VERCEL_ENV || null,
      vercel_region: process.env.VERCEL_REGION || null,
    },
    sdk: {
      name: "@anthropic-ai/sdk",
      // package.json を読んで version を返せると親切だが、
      // Next.js のバンドルで読めないことがあるのでここは固定文字列で。
    },
    ping: null as any,
  };

  if (!ping) {
    return NextResponse.json(base);
  }

  if (!hasKey) {
    return NextResponse.json(
      { ...base, ping: { ok: false, reason: "no api key" } },
      { status: 500 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });
    const t0 = Date.now();
    const r = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 32,
      messages: [{ role: "user", content: "ok と 1 単語で返答" }],
    });
    const elapsed = Date.now() - t0;
    const textBlock = r.content.find((b: any) => b.type === "text") as any;
    return NextResponse.json({
      ...base,
      ping: {
        ok: true,
        elapsed_ms: elapsed,
        model: r.model,
        stop_reason: r.stop_reason,
        usage: r.usage,
        text: textBlock?.text?.slice(0, 80) || "",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ...base,
        ping: {
          ok: false,
          error: {
            name: err?.name,
            message: err?.message,
            status: err?.status,
            type: err?.error?.type,
            detail: err?.error?.message || err?.error,
          },
        },
      },
      { status: 502 }
    );
  }
}
