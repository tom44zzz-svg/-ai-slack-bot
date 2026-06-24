#!/usr/bin/env node
// 毎朝の「AI朝刊」を生成して Slack に投稿するスクリプト。
// GitHub Actions（.github/workflows/ai-morning-digest.yml）から毎朝呼ばれる。
//
// 仕組み:
//   Claude API (Web検索ツール) で直近のAIニュースを収集
//     → 日本語ダイジェストを Slack mrkdwn 形式で生成
//     → SLACK_WEBHOOK_URL に POST
//
// 必要な環境変数（GitHub Secrets で設定）:
//   ANTHROPIC_API_KEY  … Claude API キー（必須）
//   SLACK_WEBHOOK_URL  … Slack Incoming Webhook URL（無い場合は標準出力に出すだけ）
//   DIGEST_MODEL       … 省略可。既定 claude-opus-4-8

import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.DIGEST_MODEL || 'claude-opus-4-8';
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const today = new Date().toLocaleDateString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const PROMPT = `あなたは日本語の「AI朝刊」編集者です。Web検索ツールを使い、直近24〜48時間の
「AI・AIエージェント・LLM・AI開発ツール」の最新情報を、海外ソース中心に収集して
日本語でまとめてください。X(旧Twitter)で話題の論点や、YouTubeの解説動向も拾ってください。

【今日の日付】${today}

【出力形式】Slack の mrkdwn 形式（重要: 太字は *アスタリスク1個*、リンクは <URL|表示名>）。
以下の構成で、初中級者にも分かるように簡潔に:

*☀️ AI朝刊 — ${today}*

*📌 今日の3行まとめ*
・（最重要トピック3つを1行ずつ。なぜ重要かが一言で分かるように）

*🤖 モデル / プロダクト新着*
・（OpenAI/Google/Anthropic/Microsoft など。各社1〜2行）

*🔌 エージェント & 連携*
・（MCP・フレームワーク・自律化などの動き）

*💬 Xで話題 / 🎬 動画で追うなら*
・（開発者コミュニティの論点、伸びている解説トピック）

*📈 数字・トレンド*
・（市場規模・採用率など定量情報があれば）

*🔗 ソース*
・（参照した主要URLを <URL|媒体名> 形式で5件程度）

【ルール】
- 事実は必ずWeb検索の結果に基づくこと。憶測で書かない。
- 全体で2000字以内。箇条書き中心で読みやすく。
- 専門用語には一言の補足を付ける（例: MCP(AI連携の共通規格)）。`;

async function generateDigest(client) {
  const messages = [{ role: 'user', content: PROMPT }];
  const tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: 8 }];

  let response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    tools,
    messages,
  });

  // server-side のWeb検索ループが上限に達したら pause_turn で返る → 続行
  let guard = 0;
  while (response.stop_reason === 'pause_turn' && guard++ < 8) {
    messages.push({ role: 'assistant', content: response.content });
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      tools,
      messages,
    });
  }

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (!text) throw new Error('ダイジェスト本文が空でした（stop_reason=' + response.stop_reason + '）');
  return text;
}

async function postToSlack(text) {
  if (!SLACK_WEBHOOK_URL) {
    console.log('--- SLACK_WEBHOOK_URL 未設定。本文を出力します ---\n');
    console.log(text);
    return;
  }
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, unfurl_links: false }),
  });
  if (!res.ok) {
    throw new Error(`Slack 投稿失敗: ${res.status} ${await res.text()}`);
  }
  console.log('✅ Slack に投稿しました');
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY が未設定です（GitHub Secrets に登録してください）');
  }
  const client = new Anthropic();
  const digest = await generateDigest(client);
  await postToSlack(digest);
}

main().catch((e) => {
  console.error('❌ エラー:', e.message);
  process.exit(1);
});
