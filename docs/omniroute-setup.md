# OmniRoute 導入メモ（無料AIでも `/recap` を回すため）

OmniRoute = 自分の PC で動かす AI ゲートウェイ。**OpenAI 互換の1エンドポイント**の裏に多数のプロバイダ（無料枠あり）。
MIT・無料。 <https://github.com/diegosouzapw/OmniRoute>

> ⚠️ **前提: これは Mac のターミナル（またはデスクトップ版 Claude Code）専用。**
> OmniRoute は自分の PC の中で動くので、**Web セッション（claude.ai/code）からは届きません**。
> Web で `/recap --llm` を付けても必ず失敗します。Web では `--llm` を使わず、手で JSON を書く手順に進んでください。

> 📌 このページの記述は **omniroute@3.8.50 の中身を実際に読んで、動かして** 確かめたものです（2026-09-11）。
> 確かめていないことは「未確認」と書いてあります。

---

## 一発で済ませる

```bash
bash scripts/omniroute-setup.sh
```

導入 → ループバック限定で起動 → `.env.local` に**不足している行だけ**追記 → 疎通確認まで行います。
何度実行しても同じ結果になります。既存の `.env.local` の値は書き換えません。

---

## 手でやる場合

```bash
npm install -g omniroute                                  # 一度だけ（約2.8GB）
OMNIROUTE_SERVER_HOST=127.0.0.1 omniroute serve --no-open  # 起動
```

- `omniroute` だけでも起動します（`serve` が既定のサブコマンド）
- ダッシュボード <http://localhost:20128> ／ API `http://localhost:20128/v1`
- **対話・パスワード入力はありません**（実測：6秒で起動）。管理画面のパスワードはダッシュボードのウィザードで後から設定します
- Node.js は **22.22.2 以上**が必要

### ⚠️ 既定では 0.0.0.0（全インターフェース）で待ち受ける

**何も指定しないと、同じ Wi-Fi の他の端末からあなたの OmniRoute を叩けます。**
課金プロバイダを設定していれば、その請求はあなたに来ます。起動時に警告も出ますが、**止まらずに起動します**。

必ずどちらかを付けてください。

```bash
OMNIROUTE_SERVER_HOST=127.0.0.1 omniroute serve   # 自分の PC からだけ（推奨）
REQUIRE_API_KEY=true omniroute serve              # 鍵を必須にする
```

> 変数名に注意。`OMNIROUTE_HOST` と `OMNIROUTE_PORT` は**読まれません**（実測：無視されて 0.0.0.0:20128 で起動しました）。
> ホストは `OMNIROUTE_SERVER_HOST`、ポートは `--port`（または `PORT`）です。
>
> `REQUIRE_API_KEY=true` にした場合、ダミーの鍵は 401 で弾かれます。
> ダッシュボード → API Keys で発行した鍵を `.env.local` の `RECAP_LLM_API_KEY` に入れてください。

### 疎通確認

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"こんにちは"}]}'
```

- **鍵は要りません**（既定 `REQUIRE_API_KEY=false`。鍵を付けても、間違っていても通ります）
- **`GET /v1/models` を疎通確認に使わないこと。** 鍵なしでもダミー鍵でも 401 になります（実測）。誤って「壊れている」と判断してしまいます

---

## このリポジトリ側の設定（`.env.local`）

```
RECAP_LLM_BASE_URL=http://localhost:20128/v1
RECAP_LLM_API_KEY=omniroute
RECAP_LLM_MODEL=auto
```

これで `/recap --llm` が**無料モデルで JSON を書く**ようになります。

> 💡 **`OPENAI_*` ではなく `RECAP_LLM_*` を使ってください。**
> `OPENAI_BASE_URL` / `OPENAI_API_KEY` は `--gpt`（画像生成）が本物の OpenAI 用に使います。
> そちらを OmniRoute で上書きすると、本物の鍵がダミーで潰れて画像生成が動かなくなります。
> `RECAP_LLM_*` が無いときだけ `OPENAI_*` にフォールバックします。

### 行内コメントを書かないこと

`.env.local` は自前の簡易パーサで読みます。`#` から後ろは落としますが、紛らわしいので

```
# ダミーでよい
RECAP_LLM_API_KEY=omniroute
```

のように**コメントは前の行**に書いてください。

### そのほかのつまみ

| 変数 | 既定 | 何のため |
|---|---|---|
| `RECAP_LLM_TIMEOUT_MS` | 120000 | 応答待ちの上限。遅いモデル向けに伸ばす |
| `RECAP_IMAGE_TIMEOUT_MS` | 180000 | `--gpt` の画像生成の上限 |

`--llm` は 429 と 5xx を最大3回、`Retry-After` に従って（無ければ 2秒→4秒→8秒）再送します。
無料プロバイダは日替わりで壊れるので、1回の失敗で諦めません。

---

## モデルの指定

| 指定 | 意味 |
|---|---|
| `auto` | 直近うまくいったプロバイダを使い回す（既定） |
| `auto/cheap` | トークン単価が最安のものを優先 |
| `auto/best-free` | 無料枠のものに絞る |
| `auto/coding` | コード生成向きを優先 |
| `oc/<モデル名>` | OpenCode Free を直接指名（鍵不要） |

鍵ゼロの新規インストールでも `auto` が応答する設計です（OpenCode Free が最初から組み込まれている）。

---

## できること・できないこと（正直に）

| 工程 | 無料で回るか | 使うスクリプト |
|---|---|---|
| 事実収集（git） | ✅ LLM 不要 | `scripts/recap-collect.sh` |
| **JSON を書く**（要約） | ✅ **無料モデルで可**（`auto`） | `scripts/recap-llm.mjs` |
| 図解を描く（HTML→PNG） | ✅ LLM 不要 | `scripts/recap-render.mjs` |
| 図解を**画像生成AI**で描く | ❌ 有料 | `scripts/recap-gpt-image.mjs` |

OmniRoute は `POST /v1/images/generations` を持っていて、Grok Imagine / Novita / ComfyUI / Firefly などに流せます。
ただし**そこに恒久的な無料枠があるかは未確認**です。2026-09-05 時点の判断は「無料枠はほぼ無い」で、これは変えていません。

**「無料で回す」は要約までが範囲。図解本体は HTML→PNG（元々無料）で描きます。**
見せる用の図解は ChatGPT Pro の画面に JSON を貼る運用のままです（`docs/gpt-recap-instructions.md`）。

---

## Claude Code 自体を OmniRoute 経由にしたい場合

**このリポジトリの想定外です**（`CLAUDE.md` の運用は Anthropic 直結が前提）。やるなら別ディレクトリで試してください。

```bash
omniroute run claude --model <プロバイダ>/<モデル>
```

これは設定ファイルを書き換えず、環境変数を注入して Claude Code を起動するだけです
（`ANTHROPIC_BASE_URL` にルート URL、`ANTHROPIC_AUTH_TOKEN` にトークンを渡す。`/v1` は付けない）。
`--dry-run` を付けると、実行せずに何を渡すかだけ表示できます。

> ⚠️ `OPENAI_API_BASE` や `OPENAI_API_KEY` を設定しても Claude Code は読みません。

メニューバー常駐にするなら:

```bash
brew install --cask zoispag/tap/omniroute-tray
```

---

## 動かないときに見るところ

| 症状 | 見るところ |
|---|---|
| `接続できません（ECONNREFUSED）` | OmniRoute が起動しているか。Web セッションから叩いていないか |
| `API エラー 401` | `REQUIRE_API_KEY=true` になっていないか。ダッシュボードで鍵を発行して `RECAP_LLM_API_KEY` に入れる |
| `API エラー 502` | プロバイダ側の失敗。`RECAP_LLM_MODEL` を `auto/best-free` や `oc/<モデル>` に変える |
| `空の応答です` | 推論系の無料モデルは本文を返さないことがある。モデルを変える |
| `スロットが足りません` | モデルが JSON を省略した。モデルを変えるか、手で JSON を書く |

設定と DB の置き場所は `~/.omniroute/`（`DATA_DIR` で変更可）。
`~/.omniroute/.env` があると読まれるので、昔の設定が残っていないか確認してください。

---

## この環境（クラウド）で確かめた結果（2026-09-11）

参考までに。**Mac では結果が変わります**（下記の失敗はサンドボックスの通信制限が原因）。

| 試したこと | 結果 |
|---|---|
| `npm i -g omniroute` | ✅ v3.8.50 が入った |
| `OMNIROUTE_SERVER_HOST=127.0.0.1 omniroute serve` | ✅ 6秒で起動。対話なし。127.0.0.1 に限定された |
| `GET /v1/models` | ❌ 401（鍵なし・ダミー鍵とも） |
| `POST /v1/chat/completions` (`auto`) | ❌ 502。認証は通ったが、opencode.ai への通信がサンドボックスで遮断された |
| `OMNIROUTE_HOST` / `OMNIROUTE_PORT` | ❌ 無視され 0.0.0.0:20128 で起動した |
| モック相手に collect → `--llm` → PNG | ✅ 通しで成功 |
