#!/usr/bin/env node
// /recap の「中身（JSON）を外部LLMに書かせる」ルート。無料モデルでも回せるようにする経路。
// collect の出力を渡して、テンプレ用スロット JSON を返させる。画像は recap-render.mjs で描く。
//
// 使い方: node scripts/recap-llm.mjs <collect出力.txt> <out.json> [--dry-run]
// 接続先: RECAP_LLM_BASE_URL（無ければ OPENAI_BASE_URL、既定 http://localhost:20128/v1 = OmniRoute）
// 鍵    : RECAP_LLM_API_KEY（無ければ OPENAI_API_KEY、既定 omniroute）
//         ※ --gpt（画像生成）は OPENAI_* を本物の OpenAI 用に使うので、OmniRoute 側は RECAP_LLM_* を推奨
// モデル: RECAP_LLM_MODEL（既定 auto）／ タイムアウト: RECAP_LLM_TIMEOUT_MS（既定 120000）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const [inPath, outPath] = args.filter((a) => !a.startsWith('--'));
if (!inPath || !outPath) { console.error('usage: recap-llm.mjs <collect.txt> <out.json> [--dry-run]'); process.exit(1); }

// .env.local の1行を dotenv 相当に解釈する。値はログに出さない。
function envOf(name) {
  if (process.env[name]) return process.env[name];
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)$`, 'm'));
    if (m) {
      let v = m[1].replace(/\r$/, '').trim();
      const q = v.match(/^(['"])([\s\S]*?)\1/);
      if (q) return q[2];                       // 引用符付きはそのまま（# も値の一部）
      return v.replace(/\s+#.*$/, '').trim();   // 裸の値は行内コメントを落とす
    }
  }
  return '';
}
// 秘密がパスに入る形式（OmniRoute の /vscode/<KEY>/）があるので、表示時はマスクする。
const maskUrl = (u) => u.replace(/\/(vscode|key|k)\/[^/]+/gi, '/$1/***');

const baseUrl = (envOf('RECAP_LLM_BASE_URL') || envOf('OPENAI_BASE_URL') || 'http://localhost:20128/v1').replace(/\/+$/, '');
const model = envOf('RECAP_LLM_MODEL') || 'auto';
const key = envOf('RECAP_LLM_API_KEY') || envOf('OPENAI_API_KEY') || 'omniroute';
const timeoutMs = Number(envOf('RECAP_LLM_TIMEOUT_MS')) || 120000;

// テンプレ（scripts/recap-template.html）の12スロット。文字列と配列を分けて検証する。
const STR_SLOTS = ['title', 'subtitle', 'period', 'stat_commits', 'stat_files', 'stat_lines', 'oneliner', 'footer'];
const ARR_SLOTS = ['did', 'built', 'decided', 'next'];

const facts = readFileSync(inPath, 'utf8');
const system = `あなたは開発作業の振り返り図解を作る編集者。与えられた git の事実だけから、次の JSON を日本語で返す。JSON 以外は一切出力しない。
{
 "title": "主題（28字以内。強調は **太字**）",
 "subtitle": "何の期間かを一文（60字以内）",
 "period": "期間とブランチ（事実の1行目・2行目から）",
 "stat_commits": "コミット数（事実の数字そのまま）",
 "stat_files": "変更ファイル延べ（そのまま）",
 "stat_lines": "+追加 / -削除（そのまま）",
 "did": ["やったこと。動詞で始める。3〜6項目。各40字以内"],
 "built": ["作ったもの。ファイル名は \`バッククォート\`。3〜6項目。各45字以内"],
 "decided": ["**決定** ─ 理由。2〜4項目。各55字以内。理由が読み取れない決定は書かない"],
 "next": ["未完了・次の一手。1〜3項目。各40字以内"],
 "oneliner": "この期間を1行で（45字以内）",
 "footer": "/recap ／ 生成日"
}
数字は事実から写す。推測で盛らない。最小十分情報で。`;

const baseBody = {
  model,
  messages: [{ role: 'system', content: system }, { role: 'user', content: facts }],
  temperature: 0.2,
  stream: false,
  max_tokens: 1500,
};
if (dry) { console.log(JSON.stringify({ ...baseBody, response_format: { type: 'json_object' } }, null, 2)); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 429/5xx は Retry-After（無ければ 2s→4s→8s）で最大3回まで再送する。
// 無料プロバイダは日替わりで壊れるので、1回の失敗で諦めない。
async function callOnce(body) {
  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') {
      console.error(`応答がありません（${Math.round(timeoutMs / 1000)}秒）。別のモデルを試すか RECAP_LLM_TIMEOUT_MS を伸ばしてください。`);
      process.exit(2);
    }
    const code = e?.cause?.code || '';
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EHOSTUNREACH') {
      console.error(`接続できません: ${maskUrl(baseUrl)}（${code}）。OmniRoute が起動しているか確認してください → docs/omniroute-setup.md`);
      console.error('※ Web セッション（claude.ai/code）からは Mac の localhost に届きません。--llm はローカルの Claude Code 専用です。');
      process.exit(2);
    }
    console.error(`接続に失敗しました: ${maskUrl(baseUrl)}（${e?.message || e}）`);
    process.exit(2);
  }
  return res;
}

async function call() {
  let body = { ...baseBody, response_format: { type: 'json_object' } };
  let droppedFormat = false;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await callOnce(body);
    if (res.ok) return res;

    const text = (await res.text()).slice(0, 1000);
    // response_format 非対応のプロバイダに当たったら、一度だけ外して再送する。
    if (res.status === 400 && !droppedFormat && /response_format/i.test(text)) {
      droppedFormat = true;
      body = { ...baseBody };
      console.error('response_format 非対応のため外して再送します。');
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      console.error(`API エラー ${res.status}: ${text}`);
      console.error('鍵が要求されています。OmniRoute の Dashboard → API Keys で発行した鍵を .env.local の RECAP_LLM_API_KEY に入れてください。');
      console.error('※ 疎通確認に GET /v1/models は使わないこと（鍵なし・ダミー鍵とも 401 になります）。');
      process.exit(1);
    }
    const retriable = res.status === 429 || (res.status >= 500 && res.status <= 504);
    if (!retriable || attempt === 3) {
      console.error(`API エラー ${res.status}: ${text}`);
      if (res.status === 502) console.error('プロバイダ側で失敗しています。RECAP_LLM_MODEL を auto/best-free や oc/<モデル> に変えて試してください。');
      process.exit(1);
    }
    const ra = Number(res.headers.get('retry-after'));
    const waitMs = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000 * 2 ** attempt;
    console.error(`API エラー ${res.status}。${Math.round(waitMs / 1000)}秒待って再送します（${attempt + 1}/3）。`);
    await sleep(waitMs);
  }
}

console.log(`接続先: ${maskUrl(baseUrl)}  model=${model}`);
const res = await call();

const raw = await res.text();
let data;
try { data = JSON.parse(raw); }
catch { console.error(`応答が JSON ではありません: ${raw.slice(0, 300)}`); process.exit(1); }
if (data?.error?.message) { console.error(`API エラー（本文）: ${data.error.message}`); process.exit(1); }

const choice = data?.choices?.[0];
let text = choice?.message?.content ?? '';
if (!String(text).trim()) {
  console.error(`空の応答です（model=${data.model || model}, finish_reason=${choice?.finish_reason || '不明'}）。`);
  console.error(JSON.stringify(data).slice(0, 300));
  console.error('推論系の無料モデルは本文を返さないことがあります。RECAP_LLM_MODEL を変えて試してください。');
  process.exit(1);
}

// 推論系モデルの <think> と、前後の説明文・コードフェンスを剥がして JSON 本体を取り出す。
text = String(text).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
let json;
try {
  json = JSON.parse(text);
} catch {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s >= 0 && e > s) { try { json = JSON.parse(text.slice(s, e + 1)); } catch { /* 下の分岐で報告 */ } }
}
if (!json) { console.error('JSON として読めませんでした:\n' + text.slice(0, 600)); process.exit(1); }

// テンプレのスロットを機械で検証する（欠落は render が空欄で静かに描いてしまうため）。
const missing = [], wrong = [];
for (const k of STR_SLOTS) {
  if (json[k] === undefined || json[k] === null || String(json[k]).trim() === '') { missing.push(k); continue; }
  if (typeof json[k] !== 'string') json[k] = String(json[k]);   // 数値は文字列に寄せる
}
for (const k of ARR_SLOTS) {
  if (json[k] === undefined || json[k] === null) { missing.push(k); continue; }
  if (!Array.isArray(json[k])) { wrong.push(`${k}（配列でない）`); continue; }
  json[k] = json[k].map(String).filter((v) => v.trim() !== '');
  if (json[k].length === 0) missing.push(k);
}
if (missing.length || wrong.length) {
  if (missing.length) console.error(`スロットが足りません: ${missing.join(', ')}`);
  if (wrong.length) console.error(`型が違います: ${wrong.join(', ')}`);
  console.error('モデルを変えて再実行するか、JSON を手で書いてください（/recap の手順2）。');
  process.exit(1);
}

writeFileSync(outPath, JSON.stringify(json, null, 2));
console.log(`JSON を書き出しました → ${outPath}（model=${data.model || model}）`);
console.log('※ 数字（コミット数・ファイル数・増減行）は collect の出力と必ず突き合わせてください。');
