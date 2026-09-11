---
description: 振り返り図解 — 今日/今回やったこと・作った仕様・決めたことを1枚のPNGにする（トークン最小）
---

振り返り図解を作る。引数: $ARGUMENTS（`today`＝既定 / `3d` / `<rev>..<rev>` / 任意の期間説明。末尾に `--gpt` を付けると GPT 画像生成版も並べて作る。`--llm` を付けると JSON を外部LLM（OmniRoute 経由の無料モデル可）に書かせる）

**目的**: エージェントの出力は文字列が長く、あとで「結局何をしたんだっけ」になる。
**1枚の図解に圧縮して、そのケースを潰す。** 文章の要約ではなく、見て分かる形にする。

## トークンを使わないための鉄則（最重要）

- **会話ログを読み返さない。貼らない。** 事実は `scripts/recap-collect.sh` の出力（30行程度）と、自分の作業記憶だけから書く
- **書くのは JSON 1個だけ。** HTML も CSS も高さ調整も書かない（テンプレ固定・高さ自動）
- **各項目は1行・上限あり**（下記）。上限を超えるなら、それは2項目に割るのではなく**捨てる**
- 数字（コミット数・ファイル数・行数）は **collect の実測値をそのまま**。推測で書かない
- 最小十分情報で。削るのではなく圧縮する

## 手順

1. 事実を集める:
   ```bash
   scripts/recap-collect.sh $ARGUMENTS
   ```
2. 出力を読み、JSON を `docs/recaps/YYYY-MM-DD-<短いslug>.json` に書く（JST日付）:
   ```json
   {
     "title": "…主題（28字以内。<span class=\"ac\"> は使えないので **強調** で）",
     "subtitle": "…一文で何の期間か（60字以内）",
     "period": "2026-08-15 〜 08-16 ／ claude/…ブランチ",
     "stat_commits": "12", "stat_files": "18", "stat_lines": "+840 / -120",
     "did":     ["動詞で始める。3〜6項目。各40字以内"],
     "built":   ["成果物。`ファイル名` やコマンド名を入れる。3〜6項目。各45字以内"],
     "decided": ["**決定** — 理由。2〜4項目。各55字以内。理由の無い決定は書かない"],
     "next":    ["未完了・次の一手。1〜3項目。各40字以内"],
     "oneliner": "この期間を1行で言うと（覚える一言）。45字以内",
     "footer":  "/recap ／ 生成日"
   }
   ```
   `**太字**` と `` `コード` `` だけ使える。それ以外の記法は素の文字として出る。
3. 描画:
   ```bash
   node scripts/recap-render.mjs docs/recaps/<同名>.json docs/recaps/<同名>.png
   ```
   （`puppeteer-core` が無ければ `PUPPETEER_SKIP_DOWNLOAD=1 npm i puppeteer-core --no-save`。
   　Chrome の場所は `CHROME_PATH` で指定できる）
4. PNG を `SendUserFile` で本人に送る（`display: render`）
5. **本人に聞かずに**、JSON と PNG をコミットする（振り返りは資産。`.html` は捨ててよい）

### `--llm` が付いているとき（JSON を外部LLMに書かせる・無料モデル可）

> ⚠️ **ローカルの Claude Code 専用。** OmniRoute は本人の Mac の中で動くので、Web セッション（claude.ai/code）からは到達できない。
> Web では `--llm` を無視して、上の通常ルート（自分で JSON を書く）に進むこと。試すだけ無駄にトークンを使う。

自分で JSON を書かず、collect の出力を `scripts/recap-llm.mjs` に渡して書かせる。接続先は `RECAP_LLM_BASE_URL`（無ければ `OPENAI_BASE_URL`。既定 OmniRoute `http://localhost:20128/v1`、モデル `auto`）。設定は `docs/omniroute-setup.md`。

```bash
FACTS="${TMPDIR:-/tmp}/recap-<slug>.facts.txt"       # facts は一時ファイル。コミットしない
scripts/recap-collect.sh <期間> > "$FACTS"
node scripts/recap-llm.mjs "$FACTS" docs/recaps/<slug>.json
node scripts/recap-render.mjs docs/recaps/<slug>.json docs/recaps/<slug>.png
rm -f "$FACTS"
```

- 返った JSON は**必ず目視で確認**する（無料モデルは数字を盛る・項目を落とすことがある）。数字は collect と突き合わせ、違えば直す
- スクリプトが12スロットの欠落・型違いを機械で弾く。それでも**中身の正しさは見ない**ので、目視は省略しない
- 接続できなければ（ゲートウェイ未起動など）、その旨を1行で伝えて**自分で JSON を書く通常ルートに戻る**

### 2本立ての運用（2026-09-05 決定）

- **既定 = HTML→PNG**。自動生成・記録・Routine 用。文字が確定する
- **人に見せる用 = GPT Image（ChatGPT Pro の画面）**。本人が JSON を Custom GPT に貼る。
  出てきた画像を受け取ったら、**JSON と1項目ずつ照合して、足された文字・欠けた文字を指摘する**（実測で「飾りの英語を足す」癖あり）

### `--gpt` が付いているとき

同じ JSON から GPT 版も作る（API キーがあれば直接生成、無ければ JSON と Custom GPT の案内を渡す）。

```bash
node scripts/recap-gpt-image.mjs docs/recaps/<同じ>.json docs/recaps/<同じ>-gpt.png
```

- `OPENAI_API_KEY` が無ければ、スクリプトがプロンプトを `<slug>-gpt.prompt.txt` に書き出して正常終了する。**ChatGPT Pro の枠で回す場合はこちらが既定**: `docs/gpt-recap-instructions.md` の Custom GPT に **JSON をそのまま貼る**よう本人に案内し、JSON ファイルを SendUserFile で渡す
- Firefly で試したい場合は `--dry-run` の出力を `docs/recaps/<slug>.firefly-prompt.txt` に保存して渡す（本人が Firefly の UI で生成する。API は個人プランでは使えない → `docs/omniroute-setup.md`）
- 出来た2枚を**両方** SendUserFile で送る。**文字の崩れ・欠落があれば必ず指摘する**（画像生成は文字が確率的）
- 判定は本人に委ねる。どちらが良いかを勝手に決めない

## 4枠の書き分け

| 枠 | 何を書くか | 書かないもの |
|---|---|---|
| 01 やったこと | 行動。動詞始まり | 感想・経緯 |
| 02 作ったもの・仕様 | 成果物と、その仕様の要点 | 途中で捨てた案 |
| 03 決めたこと | **判断と理由**。brain の思想（なぜを残す） | 理由が言えない決定 |
| 04 未完了・次の一手 | 残っているもの。本人の手が要るもの | 願望 |

## 出力後

- 図解を出したら、本文の説明は**3行以内**。図解が本体
- 期間内に `brain/` に残すべき判断があれば、`/brain` を勧める（やらない。勧めるだけ）
