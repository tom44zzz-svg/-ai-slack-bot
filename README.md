# Canva フィード投稿 自動生成アプリ（仕様フェーズ）

ネタを投入すると、**フォーマット選択 → タイトル 3 案 + スライド構成案 + ビジュアル指示** が
自動出力される Web アプリ。本リポジトリは**仕様を固める第 1 フェーズ**の成果物。

```
ネタ
  ↓ (1) フォーマット選択（3 軸で絞り込み）
  ↓ (2) 図解の確認・選択
  ↓ (3) 自動生成（Web 検索＋制作ルール反映）
構成案 ＋ タイトル 3 案 ＋ 写真指定 ＋ 図解指定
  ↓ (4) 自動セルフチェック（制作ルール 14 + 品質 17）
出力（テキスト埋めるだけの状態）
```

## ディレクトリ構成

```
.
├── README.md                 （このファイル）
├── data/                     機械可読な辞書群（bot の正本）
│   ├── elements.yaml             要素タイプ辞書（テキスト／ビジュアル／写真雰囲気）
│   ├── diagram-gallery.yaml      図解タイプ辞書（20 種、ASCII プレビュー付）
│   ├── templates.yaml            スライドテンプレ（23 種、3 層スキーマ）
│   ├── formats.yaml              投稿フォーマット（20 種、軸タグ＋リスクフラグ）
│   ├── cta-patterns.yaml         CTA 誘導パターン（4 種）
│   ├── writing-rules.yaml        制作ルール（14 項目）
│   ├── quality-checklist.yaml    プロット品質チェック（17 項目）
│   └── source-posts.yaml         分析元の過去投稿メタ情報
└── docs/                     人間向けドキュメント
    ├── format-spec.md            仕様書本体
    ├── format-catalog.md         フォーマット詳細カタログ
    ├── diagram-catalog.md        図解ギャラリー
    ├── app-flow.md               Web アプリの UX フロー
    └── dry-run.md                実例検証（1 ネタで動作確認済）
```

## 設計の要点

- **3 軸での選択**：フック（7 値）× トーン（3 値）× 構造（7 値）で直感的に絞り込み
- **3 層スキーマ**：各スライドを `zone_top` / `zone_middle` / `zone_bottom` に分割
- **20 フォーマット × 23 テンプレ × 20 図解 × 35 要素**：組合せで幅広いネタに対応
- **最大 10 枚・最小 5 枚**の枚数制約
- **CTA 固定**：最終スライドは自動追加（選択不要）
- **制作ルール 14 項目**：抵触 0 を強制せず「リスクフラグで通知」
- **写真は Canva 素材**：`photo_moods` で雰囲気指定のみ、具体素材は Canva 側で選定

## 次フェーズ（進行中）

- ✅ Web アプリ MVP 実装（Next.js + TypeScript + Tailwind + Anthropic SDK）
- Canva への貼り付けエクスポート（未）
- 統一表記ルール別シートの取り込み（未）
- キャプション本文の自動生成（未）

詳細は `docs/format-spec.md` と `docs/app-flow.md` を参照。

---

# MVP アプリを動かす

## セットアップ

```bash
# 1. 依存インストール
npm install

# 2. Anthropic API キーを設定
cp .env.example .env.local
# .env.local を編集して ANTHROPIC_API_KEY=sk-ant-... を入れる

# 3. 開発サーバー起動
npm run dev
```

http://localhost:3000 を開くと単一ページのアプリが表示される。

## 使い方

1. **Step 1**：ネタ本文（必須）、ターゲット、ゴールを入力
2. **Step 2**：3 軸（フック / トーン / 構造）で絞り込み（任意）
3. **Step 3**：フォーマット候補カードから 1 つ選択
4. 「構成案を生成」ボタンをクリック → 数十秒で結果が表示される

## 出力内容

- タイトル案 3 つ
- スライド構成（上・中・下 × 枚数）
- 写真のイメージ指定 / 図解指定
- キャプション概要
- リスクフラグ（制作ルール抵触の可能性）
- CTA スライド（最終スライドに自動追加）

## ディレクトリ（コード）

```
app/
├── layout.tsx            レイアウト + Tailwind
├── page.tsx              単一ページアプリ（全 UI）
├── globals.css
└── api/
    ├── formats/route.ts  GET: 3 軸フィルタでフォーマット候補を返す
    └── generate/route.ts POST: Anthropic API を呼んで構成案を生成
lib/
├── data-loader.ts        data/*.yaml のサーバー側ロード
├── filter.ts             3 軸フィルタ
└── prompt.ts             LLM プロンプト組み立て
```

## ビルド / デプロイ

```bash
npm run build && npm run start     # 本番ビルド
```

Vercel 等へのデプロイ時は環境変数 `ANTHROPIC_API_KEY` を設定すること。
