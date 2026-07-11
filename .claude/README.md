# .claude/ — Claude Code 使いこなし設定

このリポジトリ向けに「AIエージェントの周辺の仕組み」を実際に導入したもの。
図解（AIエージェント エコシステム全体図）の②接続の仕組み・使いこなし項目に対応する。

## 入っているもの

| パス | 種類 | 役割 | 図解の対応箇所 |
|---|---|---|---|
| `settings.json` | 権限 + Hooks | `defaultMode: acceptEdits`＋危険操作の`ask`＋allowlist／SessionStartで`npm install`／`data/*.yaml`編集時に自動検証／Notification通知 | 権限最適化・Hooks |
| `commands/check.md` | Slash Command | `/check` で lint + build + データ検証を一括 | Slash Command |
| `commands/new-format.md` | Slash Command | `/new-format` でフォーマット追加を支援 | Slash Command |
| `commands/order.md` | Slash Command | `/order` で受注案件を処理（ヒアリング→構成→納品文書） | Slash Command |
| `commands/brand-mock.md` | Slash Command | `/brand-mock` でブランド価値観→デザインモック生成 | Slash Command |
| `commands/gokugen.md` | Slash Command | `/gokugen` で5役×3周の高負荷制作プロセス | Slash Command |
| `skills/content-data/SKILL.md` | Skill (.md) | YAML辞書の編集・拡張・検証ガイド | スキル(.md) |
| `skills/client-work/SKILL.md` | Skill (.md) | 受注案件対応のワークフロー | スキル(.md) |
| `agents/data-reviewer.md` | Subagent | データ整合性レビュー専門 | Subagent（分業） |
| `agents/gokugen-*.md` | Subagent×5 | 極限起動の5役（戦略/設計/生成/破壊/仕上げ・役ごとにモデル最適化） | Subagent（並列分業） |
| `../.mcp.example.json` | MCP | 外部サービス連携のテンプレート | MCP |
| `../scripts/*.mjs` | スクリプト | validate-data / hook-validate / notify | （土台） |

## 使い方メモ

- **許可プロンプトをスマホで受ける/承認する**: Claude公式アプリ（iOS/Android）に同じアカウントでログインし通知をON。Webセッションの許可待ちがプッシュで届き、その場で承認できる。`settings.json` の allowlist で「そもそも聞かれる回数」を減らすとさらに快適。
- **MCPを本接続する**: `.mcp.example.json` を `.mcp.json` にコピーし、トークンを環境変数で渡す。機密を含む `.mcp.json` は `.gitignore` 推奨。
- **データ辞書を触ったら**: `/check` か `node scripts/validate-data.mjs`。編集時はフックでも自動実行される。

## 日本語で使う

- 英語のスキル名が分かりにくいときは **`スキル早見表.md`**（同ディレクトリ）を参照。全スキルを「何をする・いつ使う」で日本語一覧にしてある。
- CLAUDE.md に「Claudeの説明・スキル実行時の解説・結果はすべて日本語」と指示済み。英語スキルが動いても結果は日本語で返る。
- 名前を覚えなくてよい。「差分をレビューして」等と日本語で頼めばClaudeが該当スキルを選ぶ。

## 上級運用ガイド（公式ノウハウ 2026 の実践）

このリポジトリで潜在能力を出し切るためのコマンド。**「時間かけていいから品質優先」は口頭でなくスイッチで**。

**品質・思考の制御**
- `/effort xhigh`（コーディング推奨）/ `/effort max`（最重要案件・セッション限定）… 推論深度を上げる
- `/plan`（Shift+Tab でも可）… 実装前に読んで計画→承認。モックの構図決め・大改修の手戻りを防ぐ
- `/goal <条件>`（例: `/goal 品質ゲート6項目すべて合格`）… 達成まで自走させる

**セッション衛生**
- `/context` … トークン消費を可視化。長いセッション（今回のような）の前に確認
- `/rewind` … コード＋会話をチェックポイントまで巻き戻す。モックの「1つ前の良かった版」に戻れる
- `/compact "◯◯に集中"` … 文脈を要約して圧縮（CLAUDE.md・skills・agentは自動で残る）
- `/memory` … 自動蓄積された学習（buildコマンド等）の棚卸し

**分業・並列**
- `/gokugen <テーマ>` … 5役サブエージェントで高負荷制作。破壊者の批評が主文脈を汚さない
- `/batch <指示>` … worktreeで並列に別々の変更（別ブランド展開などに）
- 独立な調査・生成は複数サブエージェントに**並列**で投げる

**権限（settings.json で設定済み）**
- `defaultMode: acceptEdits` … コード編集は自動、シェル/ネットワークのみ確認
- `ask` … `git push` / `rm -rf` / `curl` / `npx` は必ず確認（安全と速度の両立）
- スマホ通知は Claude公式アプリ、または `NOTIFY_WEBHOOK` を設定すれば Notification フックが ntfy/Slack へ飛ばす

> 新機能はバージョン依存。`/doctor` で自分の環境の対応状況を確認してから使う。

## まだ手動・未導入（鍵やアカウントが要るもの）

- 各SaaS（Slack/Stripe/Notion等）の**本番トークン接続** … `.env.local` / `.mcp.json` に各自設定
- RAG（自社データのベクトル検索） … データソースが決まってから
- OAuthを伴う双方向連携 … 連携先ごとに個別設定
