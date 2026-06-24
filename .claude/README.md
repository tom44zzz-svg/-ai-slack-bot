# .claude/ — Claude Code 使いこなし設定

このリポジトリ向けに「AIエージェントの周辺の仕組み」を実際に導入したもの。
図解（AIエージェント エコシステム全体図）の②接続の仕組み・使いこなし項目に対応する。

## 入っているもの

| パス | 種類 | 役割 | 図解の対応箇所 |
|---|---|---|---|
| `settings.json` | 権限 + Hooks | 安全な操作を allowlist 化（許可プロンプト削減）／SessionStartで`npm install`／`data/*.yaml`編集時に自動で整合性チェック | 権限最適化・Hooks |
| `commands/check.md` | Slash Command | `/check` で lint + build + データ検証を一括 | Slash Command |
| `commands/new-format.md` | Slash Command | `/new-format` でフォーマット追加を支援 | Slash Command |
| `skills/content-data/SKILL.md` | Skill (.md) | YAML辞書の編集・拡張・検証ガイド | スキル(.md) |
| `agents/data-reviewer.md` | Subagent | データ整合性レビュー専門エージェント | Subagent（分業） |
| `../.mcp.example.json` | MCP | 外部サービス連携のテンプレート | MCP |
| `../scripts/validate-data.mjs` | スクリプト | data/*.yaml の構文 + ID相互参照を検証 | （土台） |
| `../scripts/hook-validate.mjs` | スクリプト | PostToolUseフックの薄いラッパー | （土台） |

## 使い方メモ

- **許可プロンプトをスマホで受ける/承認する**: Claude公式アプリ（iOS/Android）に同じアカウントでログインし通知をON。Webセッションの許可待ちがプッシュで届き、その場で承認できる。`settings.json` の allowlist で「そもそも聞かれる回数」を減らすとさらに快適。
- **MCPを本接続する**: `.mcp.example.json` を `.mcp.json` にコピーし、トークンを環境変数で渡す。機密を含む `.mcp.json` は `.gitignore` 推奨。
- **データ辞書を触ったら**: `/check` か `node scripts/validate-data.mjs`。編集時はフックでも自動実行される。

## まだ手動・未導入（鍵やアカウントが要るもの）

- 各SaaS（Slack/Stripe/Notion等）の**本番トークン接続** … `.env.local` / `.mcp.json` に各自設定
- RAG（自社データのベクトル検索） … データソースが決まってから
- OAuthを伴う双方向連携 … 連携先ごとに個別設定
