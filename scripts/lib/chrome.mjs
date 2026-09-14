// 図解の書き出しで使う Chrome の共通設定。
// recap-render.mjs（/recap）と render-lesson.mjs（/lesson）の両方がこれを使う。
//
// ねらい:
//   1. Chrome の探し方を1箇所にまとめる（スクリプトごとに探索先が違って迷子になっていた）
//   2. 色と文字の出方を固定する（白基調＋ネイビー/ブルー/ゴールドを毎回同じ値で出す）
//   3. 余計な通信と後始末を止める
//
// プロファイルは毎回使い捨てにして、終わったら消す。
// 使い回す案は実測で **遅かった**（共有 1991ms / 使い捨て 1768ms。2026-09-14 計測）。
// Chrome が既存の設定とキャッシュ索引を読み書きする分だけ損をする。
// 同時に2本走らせてもプロファイルの取り合いにならない利点もある。
//
// 環境変数:
//   CHROME_PATH        … Chrome/Chromium の実行ファイル。指定があれば最優先
//   CHROME_PROFILE_DIR … プロファイルを固定したいときだけ指定（残る。既定は使い捨て）
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

// ── Chrome の場所を探す
// 候補は「よくある置き場所」を上から順に。CHROME_PATH があればそれだけを見る。
export function findChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;

  // ワイルドカードを含む候補（版番号がフォルダ名に入るもの）
  const globs = [
    '/opt/pw-browsers/chromium-*/chrome-linux/chrome',        // Claude Code のクラウド環境
    '/root/.cache/puppeteer/chrome/*/chrome-linux*/chrome',   // npx puppeteer browsers install
    join(homedir(), '.cache/puppeteer/chrome/*/chrome-linux*/chrome'),
    join(homedir(), '.cache/puppeteer/chrome/*/chrome-mac*/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'),
  ];
  for (const g of globs) {
    try {
      const hit = execSync(`ls -d ${g} 2>/dev/null | head -1`, { encoding: 'utf8' }).trim();
      if (hit && existsSync(hit)) return hit;
    } catch { /* 次の候補へ */ }
  }

  // 固定パスの候補（名前に空白が入るので glob には通さない）
  const exact = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',   // Mac
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const c of exact) if (existsSync(c)) return c;

  return '';
}

// 既定は使い捨て。CHROME_PROFILE_DIR を指定したときだけ固定の場所を使う。
export const profileDir = () => process.env.CHROME_PROFILE_DIR || '';

// ── 起動オプション
// 図解を「毎回同じ見た目で・速く」出すためだけの構成。ブラウジング用途は考えない。
function baseArgs(userDataDir) {
  return [
    `--user-data-dir=${userDataDir}`,

    // コンテナで動かすため
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',          // /dev/shm が小さい環境でのクラッシュを防ぐ

    // 見た目を固定する（ここが図解の品質に直結）
    '--force-color-profile=srgb',       // 色を毎回同じ値で出す
    '--font-render-hinting=none',       // 日本語の字形を環境差で歪ませない
    '--disable-lcd-text',               // 文字の縁に色が付くのを止める（PNG 向け）
    '--hide-scrollbars',
    '--force-device-scale-factor=1',    // 拡大率は puppeteer 側の deviceScaleFactor に任せる

    // 起動を速くする・余計な通信をしない
    '--disable-background-networking',  // 更新確認や統計送信をしない（プロキシ環境で待たされない）
    '--disable-component-update',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-pings',
    '--metrics-recording-only',
    '--disable-breakpad',
    '--mute-audio',

    // 裏に回ったタブを間引かせない（計測と描画が途中で止まらないように）
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-ipc-flooding-protection',

    '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints,InterestFeedContentSuggestions',
  ];
}

// ── 起動する
// 既定は使い捨てプロファイル。CHROME_PROFILE_DIR を指定したときだけ固定の場所を使い、
// それが使用中（別の書き出しが走っている）なら使い捨てに逃がす。
export async function launchChrome() {
  const chrome = findChrome();
  if (!chrome) {
    console.error('chrome が見つかりません。CHROME_PATH を指定するか、npx puppeteer browsers install chrome を実行してください');
    process.exit(1);
  }

  const pinned = profileDir();
  const dir = pinned || join(tmpdir(), `diagram-chrome-${process.pid}`);
  mkdirSync(dir, { recursive: true });

  const opts = { executablePath: chrome, headless: true, args: baseArgs(dir) };
  try {
    const browser = await puppeteer.launch(opts);
    return { browser, chrome, dir, keep: Boolean(pinned) };
  } catch (e) {
    if (!pinned) throw e;
    // 固定プロファイルが使用中（別の書き出しが走っている）なら使い捨てに逃がす
    const tmp = join(tmpdir(), `diagram-chrome-${process.pid}`);
    mkdirSync(tmp, { recursive: true });
    const browser = await puppeteer.launch({ ...opts, args: baseArgs(tmp) });
    return { browser, chrome, dir: tmp, keep: false, fallbackReason: e?.message || String(e) };
  }
}

// 使い捨てプロファイルを消す（CHROME_PROFILE_DIR を指定したときだけ残す）。
// 以前は puppeteer 任せで /tmp に profile が溜まっていた。
export function cleanupProfile(info) {
  if (!info || info.keep) return;
  try { rmSync(info.dir, { recursive: true, force: true }); } catch { /* 消せなくても実害なし */ }
}
