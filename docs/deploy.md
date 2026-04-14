# Vercel デプロイ手順

このアプリは Next.js なので Vercel にワンクリックでデプロイできます。

## ワンクリックデプロイ

以下のリンクを開くと、GitHub リポジトリが自動でインポートされ、
環境変数の入力画面に直接進みます：

👉 **[Deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ftom44zzz-svg%2F-ai-slack-bot&env=ANTHROPIC_API_KEY&envDescription=Anthropic%20Claude%20API%20key&envLink=https%3A%2F%2Fconsole.anthropic.com%2Fsettings%2Fkeys&project-name=feed-post-generator&repository-name=feed-post-generator)**

## 手動デプロイ（上記リンクが動かない場合）

1. [Vercel](https://vercel.com) にログイン（GitHub 連携済み前提）
2. 「Add New → Project」
3. GitHub の `tom44zzz-svg/-ai-slack-bot` リポジトリを import
4. **Production Branch** を `claude/analyze-canva-formats-yqqe4` に変更
   （デフォルトで `main` が選ばれる可能性があるため）
5. **Environment Variables** で以下を追加：
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-...`（[Anthropic Console](https://console.anthropic.com/settings/keys) で取得）
6. 「Deploy」をクリック

数分後、`https://feed-post-generator-xxx.vercel.app` のような URL で公開されます。

## 設定で気をつけるポイント

### Node バージョン
Vercel の Project Settings → General → Node.js Version で **20.x 以上** を指定
（ローカルの開発では 22 を使用）。

### Root Directory
リポジトリ直下に `package.json` があるので、特に変更不要。

### 関数の実行時間
`/api/generate` は Web 検索有効時に 60〜90 秒かかることがあります。
Vercel の Hobby プランでは最大 60 秒の制限があるので、超えるときは有料プランか、
web_search を OFF にして使ってください（画面のチェックボックス）。

実装側では `maxDuration = 120` を指定済みですが、プランに依存します。

## 再デプロイ

ブランチ `claude/analyze-canva-formats-yqqe4` に push すると、
Vercel が自動で検知して再デプロイします。

## トラブルシュート

### 「ANTHROPIC_API_KEY が未設定です」と出る
Vercel の Project Settings → Environment Variables を確認。
Production / Preview / Development の全スコープにチェックが入っているか確認。

### `/api/generate` がタイムアウトする
- Web 検索のチェックを外して試す（高速）
- ネタを簡潔にする
- プランを上げる（Hobby 60s → Pro 300s）

### 画面は出るが生成が失敗する
ブラウザの DevTools → Network → `/api/generate` のレスポンスを確認。
エラーメッセージが構造化されて返ります。
