#!/bin/bash
# OmniRoute を Mac で使えるようにする一発スクリプト（何度実行しても同じ結果になる）。
#
#   bash scripts/omniroute-setup.sh
#
# やること: 導入 → ループバック限定で起動 → .env.local に不足行だけ追記 → 疎通確認。
# 注意: このリポジトリの Web セッション（claude.ai/code）では意味がない。Mac のターミナルで実行すること。
set -euo pipefail

PORT="${OMNIROUTE_TEST_PORT:-20128}"
BASE="http://127.0.0.1:${PORT}"
LOG="${TMPDIR:-/tmp}/omniroute-serve.log"
ENV_FILE=".env.local"

say() { printf '%s\n' "$*"; }
die() { printf 'エラー: %s\n' "$*" >&2; exit 1; }

[ -f "package.json" ] || die "リポジトリのルートで実行してください（package.json が見つかりません）"
command -v npm >/dev/null 2>&1 || die "npm が見つかりません。Node.js 22.22.2 以上を入れてください"

# ── 1. 導入（入っていれば更新しない。2.8GB あるので毎回は触らない）
if command -v omniroute >/dev/null 2>&1; then
  say "✔ omniroute 導入済み: $(omniroute --version 2>/dev/null || echo '版不明')"
else
  say "→ omniroute を導入します（2.8GB・数分かかります）"
  npm install -g omniroute
  say "✔ 導入しました: $(omniroute --version 2>/dev/null || echo '版不明')"
fi

# ── 2. 起動（既に上がっていれば使い回す）
# 既定は 0.0.0.0 で待ち受ける＝同じ Wi-Fi の他端末から叩ける。必ず 127.0.0.1 に絞る。
if curl -fsS -m 3 -o /dev/null "${BASE}/dashboard" 2>/dev/null || curl -fsS -m 3 -o /dev/null "${BASE}" 2>/dev/null; then
  say "✔ ${BASE} で既に動いています（起動しなおしません）"
else
  say "→ ${BASE} で起動します（ログ: ${LOG}）"
  OMNIROUTE_SERVER_HOST=127.0.0.1 nohup omniroute serve --port "${PORT}" --no-open >"${LOG}" 2>&1 &
  SERVE_PID=$!
  say "  PID ${SERVE_PID}。起動を待ちます…"
  i=0
  while [ "$i" -lt 60 ]; do
    if curl -fsS -m 2 -o /dev/null "${BASE}" 2>/dev/null; then break; fi
    kill -0 "${SERVE_PID}" 2>/dev/null || die "起動に失敗しました。ログを見てください: ${LOG}"
    sleep 1
    i=$((i + 1))
  done
  [ "$i" -lt 60 ] || die "60秒待っても応答がありません。ログ: ${LOG}"
  say "✔ 起動しました（止めるときは: omniroute stop、または kill ${SERVE_PID}）"
fi

# ── 3. .env.local に不足している行だけ足す（既存の値は絶対に書き換えない）
add_if_missing() {
  name="$1"; value="$2"
  if [ -f "${ENV_FILE}" ] && grep -qE "^[[:space:]]*(export[[:space:]]+)?${name}[[:space:]]*=" "${ENV_FILE}"; then
    say "  ・${name} は既にあるので触りません"
    return 0
  fi
  [ -f "${ENV_FILE}" ] || : >"${ENV_FILE}"
  # 直前が改行で終わっていない場合に備えて1行足す
  if [ -s "${ENV_FILE}" ] && [ "$(tail -c 1 "${ENV_FILE}" | wc -l)" -eq 0 ]; then printf '\n' >>"${ENV_FILE}"; fi
  printf '%s=%s\n' "${name}" "${value}" >>"${ENV_FILE}"
  say "  ・${name} を追記しました"
}

say "→ ${ENV_FILE} を確認します（既存の行は上書きしません）"
if [ ! -f "${ENV_FILE}" ]; then
  printf '# OmniRoute 経由で /recap --llm を無料モデルで回すための設定\n' >"${ENV_FILE}"
fi
add_if_missing "RECAP_LLM_BASE_URL" "${BASE}/v1"
add_if_missing "RECAP_LLM_API_KEY" "omniroute"
add_if_missing "RECAP_LLM_MODEL" "auto"

# ── 4. 疎通確認
# GET /v1/models は鍵なし・ダミー鍵とも 401 になるので、疎通判定には使わない。
say "→ 疎通を確認します（POST /v1/chat/completions, model=auto）"
RESP_FILE="${TMPDIR:-/tmp}/omniroute-probe.json"
CODE=$(curl -sS -o "${RESP_FILE}" -w '%{http_code}' -m 90 \
  -X POST "${BASE}/v1/chat/completions" \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer omniroute' \
  -d '{"model":"auto","max_tokens":16,"messages":[{"role":"user","content":"ping とだけ返して"}]}' || echo "000")

case "${CODE}" in
  200)
    say "✔ 疎通しました。/recap --llm が無料モデルで回せます。"
    say "  返答: $(head -c 200 "${RESP_FILE}")"
    ;;
  401|403)
    say "△ 鍵が要求されています（HTTP ${CODE}）。"
    say "  ${BASE}/dashboard → API Keys で鍵を発行し、${ENV_FILE} の RECAP_LLM_API_KEY に入れてください。"
    ;;
  502|503)
    say "△ 起動はしていますが、プロバイダ側で失敗しました（HTTP ${CODE}）。"
    say "  無料プロバイダは日替わりで壊れます。${ENV_FILE} の RECAP_LLM_MODEL を auto/best-free などに変えて試してください。"
    say "  本文: $(head -c 400 "${RESP_FILE}")"
    ;;
  000)
    die "${BASE} に届きませんでした。ログ: ${LOG}"
    ;;
  *)
    say "△ HTTP ${CODE}: $(head -c 400 "${RESP_FILE}")"
    ;;
esac

say ""
say "次の一手: bash scripts/recap-collect.sh today > /tmp/collect.txt && node scripts/recap-llm.mjs /tmp/collect.txt /tmp/slots.json"
