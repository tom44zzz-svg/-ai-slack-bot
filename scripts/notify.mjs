#!/usr/bin/env node
// Notification フックのハンドラ。Claude Code が「許可待ち／入力待ち」等で
// 通知を出すたびに呼ばれる。環境変数 NOTIFY_WEBHOOK があればそこへ POST し、
// 無ければ何もしない（＝壊れない）。絶対に throw せず exit 0 で終える。
//
// 使い方（任意）:
//   ntfy:  export NOTIFY_WEBHOOK="https://ntfy.sh/あなたのトピック名"
//   Slack: export NOTIFY_WEBHOOK="https://hooks.slack.com/services/..."
// 設定は .claude/settings.local.json の env か、シェルの環境変数で。
//
// ※ Claude 公式アプリの通知を使う場合はこのフック不要（アプリが直接通知する）。

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', async () => {
  const url = process.env.NOTIFY_WEBHOOK;
  if (!url) return; // 未設定なら黙って終了
  let message = 'Claude Code から通知';
  try {
    message = JSON.parse(raw)?.message || message;
  } catch {
    /* 入力が無くても既定文言で続行 */
  }
  try {
    const isSlack = url.includes('hooks.slack.com');
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': isSlack ? 'application/json' : 'text/plain' },
      body: isSlack ? JSON.stringify({ text: `🔔 ${message}` }) : message,
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* ネットワーク失敗でもフックは成功扱いにする */
  }
});
process.stdin.on('error', () => {});
