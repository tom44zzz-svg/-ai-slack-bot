# OmniRoute 導入メモ（無料AIでも `/recap` を回すため）

OmniRoute = 自分で動かす AI ゲートウェイ。**OpenAI 互換の1エンドポイント**の裏に 290+ プロバイダ（無料枠 90+）。
MIT・無料。Claude Code / Codex / Cursor などから使える。 https://github.com/diegosouzapw/OmniRoute

## Mac に入れる（本人の作業）

```bash
npm install -g omniroute     # 一度だけ
omniroute                    # 起動。ダッシュボード http://localhost:20128
```

メニューバー常駐にするなら:
```bash
brew install --cask zoispag/tap/omniroute-tray
```

- エンドポイント: `http://localhost:20128/v1`
- **初期状態でキー不要。** 無料プロバイダ（OpenCode Free など）が `auto` コンボに入っている
- 動作確認:
  ```bash
  curl http://localhost:20128/v1/chat/completions -H "Content-Type: application/json" \
    -d '{"model":"auto","messages":[{"role":"user","content":"こんにちは"}]}'
  ```

## このリポジトリ側の設定（`.env.local`）

```
OPENAI_BASE_URL=http://localhost:20128/v1
OPENAI_API_KEY=omniroute          # ダミーでよい
RECAP_LLM_MODEL=auto              # 無料プールから自動選択
```

これで `/recap --llm` が **無料モデルで JSON を書く** ようになる。

## できること・できないこと（正直に）

| 工程 | 無料で回るか | 使うスクリプト |
|---|---|---|
| 事実収集（git） | ✅ LLM 不要 | `scripts/recap-collect.sh` |
| **JSON を書く**（要約） | ✅ **無料モデルで可**（`auto`） | `scripts/recap-llm.mjs` |
| 図解を描く（HTML→PNG） | ✅ LLM 不要 | `scripts/recap-render.mjs` |
| 図解を**画像生成AI**で描く | ❌ **無料枠はほぼ無い** | `scripts/recap-gpt-image.mjs` |

画像生成は OmniRoute 経由でも xAI / Firefly / Segmind など**有料プロバイダ**に流れる。
OpenRouter の `:free` にも画像生成モデルは現状ない（2026-09 時点）。
**「無料で回す」は要約までが範囲。図解本体は HTML→PNG（元々無料）で描く。**

## Claude Code 自体を OmniRoute 経由にしたい場合

```bash
export OPENAI_API_BASE=http://localhost:20128/v1
export OPENAI_API_KEY=omniroute
```
（Claude Code の Anthropic 側は別。OpenAI 互換ツール用の設定）

## 注意

- ⚠️ **既定では 0.0.0.0 でキー無しで待ち受ける**（起動ログに警告が出る）。同じ Wi-Fi の他端末から叩けて、
  課金プロバイダを設定していればその請求が自分に来る。Mac では必ずどちらかを付けて起動する:
  ```bash
  OMNIROUTE_SERVER_HOST=127.0.0.1 omniroute      # 自分の Mac からしか繋げない（推奨）
  REQUIRE_API_KEY=true omniroute                 # キー必須にする
  ```

- 無料プロバイダは**品質・速度・上限が日替わり**。JSON が壊れて返ることがある → `recap-llm.mjs` は壊れていたら止めて中身を見せる
- ゲートウェイはローカルで動くので、**Mac が起動していないと使えない**（クラウドセッションからは届かない）
