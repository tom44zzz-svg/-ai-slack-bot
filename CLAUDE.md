# CLAUDE.md

Claude Code 用のプロジェクトメモリ。セッション開始時に自動で読み込まれる。

## このプロジェクトは何か

**Canva フィード投稿ジェネレーター**（パッケージ名 `canva-feed-post-generator`）。
ネタを入力すると「フォーマット選択 → タイトル3案 + スライド構成案 + ビジュアル指示」を
Claude API で自動生成する Next.js Web アプリ。

- スタック: Next.js 14 (App Router) / TypeScript / Tailwind / `@anthropic-ai/sdk`
- LLM 呼び出し: `app/api/generate/route.ts` → `lib/prompt.ts` で組み立て
- 必須環境変数: `ANTHROPIC_API_KEY`（`.env.local`。`.env.example` 参照）

## アーキテクチャ

```
app/
  page.tsx                単一ページUI（全Step）
  api/formats/route.ts    GET: 3軸フィルタでフォーマット候補
  api/generate/route.ts   POST: Anthropic API で構成案生成
  api/classify/route.ts   分類
lib/
  data-loader.ts   data/*.yaml をサーバー側ロード
  filter.ts        3軸（hook/tone/structure）フィルタ
  prompt.ts        LLM プロンプト組み立て
data/   ← ★ アプリの「正本」。機械可読な辞書群（下記）
docs/   人間向け仕様書
business/   受注業務キット（ヒアリング/定型文/納品テンプレ/営業資料）。deliverables/ は機密のためgit管理外
```

## data/*.yaml が正本（最重要）

ロジックの大半はコードではなく `data/` の YAML 辞書に宿る。ID で相互参照している:

| ファイル | 内容 | 参照関係 |
|---|---|---|
| `formats.yaml` | 投稿フォーマット20種（3軸タグ + recipe） | `recipe[].template_options` → templates / `risk_flags[].rule_id` → writing-rules |
| `templates.yaml` | スライドテンプレ23種（3層スキーマ） | `zone_*.element` → elements / `zone_*.diagram` → diagram-gallery |
| `elements.yaml` | 要素35種（text/visual/photo_moods） | — |
| `diagram-gallery.yaml` | 図解20種（ASCIIプレビュー付） | — |
| `writing-rules.yaml` | 制作ルール14項目 | — |
| `quality-checklist.yaml` | 品質チェック16項目 | — |
| `cta-patterns.yaml` / `source-posts.yaml` | CTA / 分析元投稿 | — |

**辞書を編集したら必ず整合性チェックを通す**:

```bash
node scripts/validate-data.mjs      # 構文 + ID相互参照を検証
```

これは PostToolUse フック（`.claude/settings.json`）で `data/*.yaml` 編集時に自動実行される。
新しい id を足すときは、参照先（template_options / element / diagram / rule_id）が実在することを確認。

## よく使うコマンド

```bash
npm run dev      # 開発サーバー (http://localhost:3000)
npm run build    # 本番ビルド
npm run lint     # Lint
node scripts/validate-data.mjs   # データ辞書の整合性チェック
```

スラッシュコマンド: `/check`（lint+build+validate を一括）, `/new-format`（フォーマット追加を支援）, `/order`（受注案件の処理: ヒアリング→構成案→納品文書）, `/brand-mock`（ブランド価値観→デザインモック生成。正本は `mock-system/SPEC.md`）, `/gokugen`（極限起動: 5役×3周＋勝利条件ファーストの高負荷制作プロセス）

## 規約・注意点

- **作業ブランチ**: `claude/ai-agent-ecosystem-visual-5ock5o`。main へ直接 push しない。
- **言語**: ドキュメント・UI・YAML の `name`/`note` は日本語。
- **秘密情報**: `.env.local` は読まない・コミットしない（settings.json で deny 済み）。
- **Vercel デプロイ**: Production Branch を `main` 以外に設定する必要あり（`docs/deploy.md`）。
- データ辞書を変えたら docs/ 側のカタログ（`format-catalog.md` 等）との齟齬も意識する。

## Claude Code セットアップ（このリポジトリに導入済み）

`.claude/` に「使いこなし」設定を導入済み。詳細は `.claude/README.md`。

- `settings.json` … 権限（defaultMode acceptEdits + 危険操作ask + allowlist）+ Hooks（SessionStartでnpm install / 編集時にYAML検証 / Notification通知）
- `commands/` … `/check`, `/new-format`, `/order`, `/brand-mock`, `/gokugen`
- `skills/` … content-data（YAML辞書）, client-work（受注対応）
- `agents/` … data-reviewer（データ整合性）, gokugen-*（極限起動5役・並列分業）
- `.mcp.example.json` … 外部サービス連携（MCP）のテンプレート
- 上級運用（`/effort` `/plan` `/context` `/rewind` 等）は `.claude/README.md` 参照
