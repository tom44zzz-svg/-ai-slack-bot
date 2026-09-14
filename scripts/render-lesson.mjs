#!/usr/bin/env node
// レッスン図解を HTML → 高解像度PNG に変換する。日本語ラベルがくっきり出る
// （画像生成AIは日本語文字を崩すので、ラベル付き図解にはこちらを使う）。
//
// 前提（初回のみ）:
//   npm i puppeteer-core
//   Chrome は scripts/lib/chrome.mjs が自動で探す（見つからなければ CHROME_PATH を指定）
//   日本語フォント: IPAGothic 等（環境に既存）
//
// 使い方:
//   node scripts/render-lesson.mjs <図解.html> [出力.png] [幅] [高さ]

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { launchChrome, cleanupProfile } from './lib/chrome.mjs';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/render-lesson.mjs <html> [png] [w] [h]'); process.exit(1); }
const out = process.argv[3] || file.replace(/\.html$/, '.png');
const W = parseInt(process.argv[4] || '1280');
const H = parseInt(process.argv[5] || '920');

const info = await launchChrome();
const browser = info.browser;
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 2 });
await page.goto(pathToFileURL(resolve(file)).href, { waitUntil: 'load', timeout: 60000 });   // networkidle0 は 740ms 待つだけで出力は同一（実測）
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: out });
await browser.close();
cleanupProfile(info);
console.log('図解を書き出しました →', out);
