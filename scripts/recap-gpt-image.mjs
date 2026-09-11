#!/usr/bin/env node
// /recap の GPT 画像生成ルート。同じスロット JSON から、OpenAI の画像生成で図解を作る。
// HTML→PNG 版（recap-render.mjs）と並べて比較するためのもの。
//
// 使い方:
//   node scripts/recap-gpt-image.mjs <slots.json> <out.png> [--dry-run]
//   --dry-run … API を呼ばず、送るプロンプトだけ表示する
//
// 必要: OPENAI_API_KEY（環境変数 or .env.local）。キーはログに一切出さない。
// 接続先: OPENAI_BASE_URL で差し替え可（既定 https://api.openai.com/v1）。
//   OmniRoute 経由なら http://localhost:20128/v1、OpenRouter なら https://openrouter.ai/api/v1
//   OmniRoute はキー不要（任意の文字列でよい）
// モデル: OPENAI_IMAGE_MODEL で上書き可（既定 gpt-image-2。404 なら gpt-image-1 を試す）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const [jsonPath, outPng] = args.filter((a) => !a.startsWith('--'));
if (!jsonPath || !outPng) { console.error('usage: recap-gpt-image.mjs <slots.json> <out.png> [--dry-run]'); process.exit(1); }

// .env.local を読む（表示はしない）
function envOf(name) {
  if (process.env[name]) return process.env[name];
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`, 'm'));
    if (m) {
      let v = m[1].replace(/\r$/, '').trim();
      const q = v.match(/^(['"])([\s\S]*?)\1/);
      if (q) return q[2];                       // 引用符付きはそのまま
      return v.replace(/\s+#.*$/, '').trim();   // 裸の値は行内コメントを落とす
    }
  }
  return '';
}
// 秘密がパスに入る形式（OmniRoute の /vscode/<KEY>/）があるので、表示時はマスクする。
const maskUrl = (u) => u.replace(/\/(vscode|key|k)\/[^/]+/gi, '/$1/***');
const loadKey = () => envOf('OPENAI_API_KEY');
const baseUrl = (envOf('OPENAI_BASE_URL') || 'https://api.openai.com/v1').replace(/\/+$/, '');
// api.openai.com 以外＝自前ゲートウェイ（OmniRoute 等）とみなす。鍵が無くてもダミーで呼ぶ。
const isLocalGateway = !/(^|\/\/)([^/]*\.)?api\.openai\.com(\/|$)/.test(baseUrl);
const imgTimeoutMs = Number(envOf('RECAP_IMAGE_TIMEOUT_MS')) || 180000;

const s = JSON.parse(readFileSync(jsonPath, 'utf8'));
const strip = (t) => String(t ?? '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');
const li = (arr) => (arr || []).map((x) => `  - ${strip(x)}`).join('\n');

const prompt = `
日本語のインフォグラフィック（振り返り図解）を1枚、横長で描いてください。
写真・イラスト・装飾・グラデーションは使わず、フラットなベクター調。
背景は白（#F5F7FB）。使う色はネイビー #14213D、ブルー #1F5FBF、ゴールド #C9A227 の3色だけ。
日本語はゴシック体で、以下の文字列を一字も変えず正確に描くこと。文字の創作・省略・置換は禁止。

【上部・見出し】
タイトル: ${strip(s.title)}
サブタイトル: ${strip(s.subtitle)}
右上に数値カード3つ: 「${s.stat_commits} コミット」「${s.stat_files} 変更ファイル」「${s.stat_lines} 追加/削除」

【中央・2×2 の4パネル。各パネルは白カード＋上辺に色の帯】
パネル01（帯はブルー）見出し「やったこと」
${li(s.did)}
パネル02（帯はネイビー）見出し「作ったもの・仕様」
${li(s.built)}
パネル03（帯はゴールド）見出し「決めたこと（理由つき）」
${li(s.decided)}
パネル04（帯は濃いゴールド、カード地は薄い黄）見出し「未完了・次の一手」
${li(s.next)}

【下部・1行】
左にゴールドの縦線を付けた帯: ${strip(s.oneliner)}
右下に小さく: ${strip(s.footer)}

レイアウトは整然と、余白を均等に。文字は読める大きさで、はみ出しや重なりを作らないこと。
元に無い文字を一切足さないこと。強調は太い書体で描き、「」や『』で囲まないこと。英語の飾り文句・ラベル・キャッチコピーは禁止。描いてよい文字は上に書いた文字列と見出しだけ。
`.trim();

if (dry) { console.log(prompt); console.log(`\n[dry-run] 文字数: ${prompt.length}`); process.exit(0); }

const key = loadKey() || (isLocalGateway ? 'omniroute' : '');
if (!key) {
  // API キーが無い → 画面に貼る運用（ChatGPT Pro / Firefly）用にプロンプトを書き出して正常終了
  const promptPath = outPng.replace(/\.png$/, '.prompt.txt');
  writeFileSync(promptPath, prompt + '\n');
  console.log(`API キーが無いので、画面に貼る用のプロンプトを書き出しました → ${promptPath}`);
  console.log('ChatGPT（Pro）なら docs/gpt-recap-instructions.md の Custom GPT に JSON を貼るだけで生成できます');
  process.exit(0);
}
const model = envOf('OPENAI_IMAGE_MODEL') || 'gpt-image-2';
console.log(`接続先: ${maskUrl(baseUrl)}  model=${model}`);

let res;
try {
  res = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size: '1536x1024', quality: 'high', n: 1 }),
    signal: AbortSignal.timeout(imgTimeoutMs),
  });
} catch (e) {
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
    console.error(`応答がありません（${Math.round(imgTimeoutMs / 1000)}秒）。RECAP_IMAGE_TIMEOUT_MS で伸ばせます。`);
    process.exit(2);
  }
  console.error(`接続に失敗しました: ${maskUrl(baseUrl)}（${e?.cause?.code || e?.message || e}）`);
  process.exit(2);
}
if (!res.ok) {
  const t = await res.text();
  console.error(`OpenAI API エラー ${res.status}: ${t.slice(0, 400)}`);
  if (res.status === 404) console.error('→ モデル名が違う可能性。OPENAI_IMAGE_MODEL=gpt-image-1 で再実行してください');
  process.exit(1);
}
const data = await res.json();
const b64 = data?.data?.[0]?.b64_json;
if (!b64) { console.error('画像が返りませんでした:', JSON.stringify(data).slice(0, 300)); process.exit(1); }
writeFileSync(outPng, Buffer.from(b64, 'base64'));
console.log(`GPT 図解を書き出しました → ${outPng}（model=${model}）`);
