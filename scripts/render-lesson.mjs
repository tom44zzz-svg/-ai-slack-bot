#!/usr/bin/env node
// レッスン図解を HTML → 高解像度PNG に変換する。日本語ラベルがくっきり出る
// （画像生成AIは日本語文字を崩すので、ラベル付き図解にはこちらを使う）。
//
// 前提（初回のみ）:
//   npm i puppeteer-core
//   npx puppeteer browsers install chrome   （/root/.cache/puppeteer に入る）
//   日本語フォント: IPAGothic 等（環境に既存）
//
// 使い方:
//   node scripts/render-lesson.mjs <図解.html> [出力.png] [幅] [高さ]

import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/render-lesson.mjs <html> [png] [w] [h]'); process.exit(1); }
const out = process.argv[3] || file.replace(/\.html$/, '.png');
const W = parseInt(process.argv[4] || '1280');
const H = parseInt(process.argv[5] || '920');

// chrome の場所を自動検出
function findChrome() {
  const cands = [
    process.env.CHROME_PATH,
    '/root/.cache/puppeteer/chrome',
  ].filter(Boolean);
  for (const base of cands) {
    if (base && existsSync(base) && base.endsWith('chrome') && !existsSync(base + '/')) return base;
  }
  try {
    return execSync("find /root/.cache/puppeteer -name chrome -type f 2>/dev/null | head -1", { encoding: 'utf8' }).trim();
  } catch { return ''; }
}
const chrome = findChrome();
if (!chrome) { console.error('chrome が見つかりません。npx puppeteer browsers install chrome を実行してください'); process.exit(1); }

const browser = await puppeteer.launch({
  executablePath: chrome, headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
await page.goto('file://' + process.cwd() + '/' + file, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: out });
await browser.close();
console.log('図解を書き出しました →', out);
