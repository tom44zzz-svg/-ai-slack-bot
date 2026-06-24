#!/usr/bin/env node
// data/*.yaml の構文チェック + ID 相互参照チェック。
// このリポジトリの「正本」である辞書群の整合性を一括検証する。
//
// 使い方:  node scripts/validate-data.mjs
// 終了コード: 0 = OK / 1 = エラー(構文 or 壊れた参照)
//
// 検証内容:
//   1. data/*.yaml がすべて構文的にロードできるか
//   2. templates が参照する element / diagram の id が実在するか
//   3. formats が参照する template_options / rule_id が実在するか

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');

const errors = [];
const warn = [];

// --- 1. すべての YAML をロード ---
const docs = {};
for (const file of readdirSync(dataDir).filter((f) => f.endsWith('.yaml'))) {
  try {
    docs[file] = yaml.load(readFileSync(join(dataDir, file), 'utf8'));
  } catch (e) {
    errors.push(`構文エラー  data/${file}: ${e.message.split('\n')[0]}`);
  }
}
if (errors.length) {
  print();
  process.exit(1);
}

// --- 2. ID プールを収集 ---
const ids = (arr) => new Set((arr ?? []).map((x) => x?.id).filter(Boolean));
const templateIds = ids(docs['templates.yaml']?.templates);
const diagramIds = ids(docs['diagram-gallery.yaml']?.diagrams);
const ruleIds = ids(docs['writing-rules.yaml']?.rules);
const el = docs['elements.yaml'] ?? {};
const elementIds = new Set([
  ...ids(el.text_elements),
  ...ids(el.visual_elements),
  ...ids(el.photo_moods),
]);

console.log(
  `収集: templates=${templateIds.size} diagrams=${diagramIds.size} ` +
    `elements=${elementIds.size} rules=${ruleIds.size}`
);

// --- 3. 参照を再帰的に走査して相互チェック ---
function walk(node, where) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, where));
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'template_options' && Array.isArray(v)) {
      v.forEach((id) => {
        if (typeof id === 'string' && !templateIds.has(id))
          errors.push(`未定義の template "${id}"  (${where})`);
      });
    } else if (k === 'diagram' && typeof v === 'string') {
      if (!diagramIds.has(v)) errors.push(`未定義の diagram "${v}"  (${where})`);
    } else if (k === 'element' && typeof v === 'string') {
      if (!elementIds.has(v)) errors.push(`未定義の element "${v}"  (${where})`);
    } else if (k === 'rule_id' && typeof v === 'string') {
      if (!ruleIds.has(v)) errors.push(`未定義の rule_id "${v}"  (${where})`);
    } else {
      walk(v, node.id ? `${where} > ${node.id}` : where);
    }
  }
}
walk(docs['formats.yaml']?.formats, 'formats.yaml');
walk(docs['templates.yaml']?.templates, 'templates.yaml');

function print() {
  for (const w of warn) console.log(`⚠ ${w}`);
  for (const e of errors) console.error(`✗ ${e}`);
}

print();
if (errors.length) {
  console.error(`\n❌ ${errors.length} 件の問題が見つかりました。`);
  process.exit(1);
}
console.log('✅ data/*.yaml の整合性チェック OK');
