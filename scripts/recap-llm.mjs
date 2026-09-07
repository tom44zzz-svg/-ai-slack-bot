#!/usr/bin/env node
// /recap の「中身（JSON）を外部LLMに書かせる」ルート。無料モデルでも回せるようにする経路。
// collect の出力を渡して、テンプレ用スロット JSON を返させる。画像は recap-render.mjs で描く。
//
// 使い方: node scripts/recap-llm.mjs <collect出力.txt> <out.json> [--dry-run]
// 接続先: OPENAI_BASE_URL（既定 http://localhost:20128/v1 = OmniRoute）／モデル: RECAP_LLM_MODEL（既定 auto）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const [inPath, outPath] = args.filter((a) => !a.startsWith('--'));
if (!inPath || !outPath) { console.error('usage: recap-llm.mjs <collect.txt> <out.json> [--dry-run]'); process.exit(1); }

function envOf(name) {
  if (process.env[name]) return process.env[name];
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(new RegExp(`^${name}=(.+)$`, 'm'));
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  }
  return '';
}
const baseUrl = (envOf('OPENAI_BASE_URL') || 'http://localhost:20128/v1').replace(/\/$/, '');
const model = envOf('RECAP_LLM_MODEL') || 'auto';
const key = envOf('OPENAI_API_KEY') || 'omniroute';

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

const body = { model, messages: [{ role: 'system', content: system }, { role: 'user', content: facts }], temperature: 0.2 };
if (dry) { console.log(JSON.stringify(body, null, 2)); process.exit(0); }

console.log(`接続先: ${baseUrl}  model=${model}`);
let res;
try {
  res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
} catch (e) {
  console.error(`接続できません: ${baseUrl}（${e?.cause?.code || e.message}）。OmniRoute が起動しているか確認してください → docs/omniroute-setup.md`);
  process.exit(2);
}
if (!res.ok) { console.error(`API エラー ${res.status}: ${(await res.text()).slice(0, 400)}`); process.exit(1); }
const data = await res.json();
let text = data?.choices?.[0]?.message?.content ?? '';
text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
let json;
try { json = JSON.parse(text); } catch { console.error('JSON として読めませんでした:\n' + text.slice(0, 600)); process.exit(1); }
writeFileSync(outPath, JSON.stringify(json, null, 2));
console.log(`JSON を書き出しました → ${outPath}（model=${data.model || model}）`);
