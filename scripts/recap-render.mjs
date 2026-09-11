#!/usr/bin/env node
// /recap 用: スロット JSON → 固定テンプレに流し込み → 高さ自動計測 → 2x PNG。
// Claude が書くのは JSON だけ。CSS も高さ調整も毎回やらない（トークン節約と品質の下限固定）。
//
// 使い方: node scripts/recap-render.mjs <slots.json> <out.png>
// JSON: { title, subtitle, period, stat_commits, stat_files, stat_lines,
//         did:[], built:[], decided:[], next:[], oneliner, footer }
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const [,, jsonPath, outPng] = process.argv;
if (!jsonPath || !outPng) { console.error('usage: recap-render.mjs <slots.json> <out.png>'); process.exit(1); }

const slots = JSON.parse(readFileSync(jsonPath, 'utf8'));
let html = readFileSync('scripts/recap-template.html', 'utf8');

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
// 最小マークアップ: **太字** と `コード` だけ許す
const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`(.+?)`/g, '<code>$1</code>');
const list = (arr) => (Array.isArray(arr) && arr.length ? arr : ['（なし）']).map((x) => `<li>${inline(x)}</li>`).join('');

const fill = {
  title: inline(slots.title), subtitle: inline(slots.subtitle), period: esc(slots.period),
  stat_commits: esc(slots.stat_commits), stat_files: esc(slots.stat_files), stat_lines: esc(slots.stat_lines),
  did: list(slots.did), built: list(slots.built), decided: list(slots.decided), next: list(slots.next),
  oneliner: inline(slots.oneliner), footer: inline(slots.footer),
};
for (const [k, v] of Object.entries(fill)) html = html.replaceAll(`{{${k}}}`, v);

const outHtml = outPng.replace(/\.png$/, '.html');
writeFileSync(outHtml, html);

function findChrome() {
  for (const c of [process.env.CHROME_PATH]) if (c && existsSync(c)) return c;
  try { return execSync("ls -d /opt/pw-browsers/chromium-*/chrome-linux/chrome /root/.cache/puppeteer/chrome/*/chrome-linux*/chrome 2>/dev/null | head -1", { encoding: 'utf8' }).trim(); } catch { return ''; }
}
const chrome = findChrome();
if (!chrome) { console.error('chrome が見つかりません（CHROME_PATH を指定）'); process.exit(1); }

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(resolve(outHtml)).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
const h = await page.evaluate(() => document.body.scrollHeight);   // ← 高さは自動
await page.setViewport({ width: 1280, height: h, deviceScaleFactor: 2 });
await new Promise((r) => setTimeout(r, 200));
await page.screenshot({ path: outPng });
await browser.close();
console.log(`図解を書き出しました → ${outPng}（1280×${h}）`);
