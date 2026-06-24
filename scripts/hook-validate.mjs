#!/usr/bin/env node
// Claude Code の PostToolUse フックから呼ばれる薄いラッパー。
// 編集されたファイルが data/*.yaml のときだけ validate-data を実行する。
// （TS/その他ファイルの編集では何もしないので軽い）
import { execSync } from 'node:child_process';

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  let path = '';
  try {
    path = JSON.parse(raw)?.tool_input?.file_path ?? '';
  } catch {
    /* フック入力が無くても黙って終了 */
  }
  if (!/data\/.*\.yaml$/.test(path)) return;
  try {
    execSync('node scripts/validate-data.mjs', { stdio: 'inherit' });
  } catch {
    // 終了コード 1 = 壊れた参照。フックを非ゼロで終わらせて Claude に知らせる。
    process.exit(2);
  }
});
