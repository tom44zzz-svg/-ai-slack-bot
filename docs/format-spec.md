# Canva フィード投稿 フォーマット仕様書

## 1. この仕様書の位置付け

ネタ（スプレッドシート 1 行、あるいはフォーム入力）を投入すると、
**フォーマットを選択 → タイトル 3 案 + スライド構成案 + ビジュアル指示** が自動出力される
Web アプリを実装するための**ルールブック**。

人間・AI の両方が参照する唯一の正本。

```
ネタ
  ↓ (1) フォーマット選択（軸 or 直接）
  ↓ (2) 図解の選択（視覚的ギャラリー）
  ↓ (3) 自動生成（Web 検索＋制作ルール反映）
構成案 ＋ タイトル 3 案 ＋ 写真指定 ＋ 図解指定 ＋ 出典 URL
  ↓ (4) 自動セルフチェック（制作ルール 14 + 品質チェック 17）
出力
```

---

## 2. データ辞書の全体像

| ファイル | 役割 | 件数 |
|----------|------|------|
| `data/formats.yaml` | 投稿フォーマット定義（20 種、軸タグ + リスクフラグ付き） | 20 |
| `data/templates.yaml` | スライドテンプレ（3 層スキーマ） | 23 |
| `data/diagram-gallery.yaml` | 図解タイプ辞書（ASCII プレビュー付） | 20 |
| `data/elements.yaml` | 要素（テキスト／ビジュアル／写真雰囲気）辞書 | 35 |
| `data/cta-patterns.yaml` | CTA 誘導パターン辞書 | 4 |
| `data/writing-rules.yaml` | 制作ルール（クライアント提示 14 項目） | 14 |
| `data/quality-checklist.yaml` | プロット品質チェック項目 | 17 |
| `data/source-posts.yaml` | 分析元となった過去投稿メタ情報 | 3 |

---

## 3. 選択軸（3 軸モデル）

ユーザーは以下 3 軸で絞り込み、**最終的に 2〜3 個のフォーマット候補**を得る。

### 軸 1：フック（1 枚目の入り方）

| ID | 名前 | 例 |
|----|------|-----|
| `question` | 問いかけ | 「〇〇できますか？」 |
| `number` | 数字強調 | 「〇〇 5 選」「TOP10」 |
| `promise` | 約束・解決 | 「〇〇する方法」「〇〇が解決」 |
| `mistake` | 失敗警告 | 「やりがちな〇〇」「損する〇〇」 |
| `myth` | 常識反転 | 「実は〇〇」「〇〇は嘘」 |
| `story` | 体験・告白 | 「私が〇〇した話」「あのとき〇〇」 |
| `category` | 宣言・定義 | 「〇〇とは？」「〇〇の基本」 |

### 軸 2：感情トーン

| ID | 名前 |
|----|------|
| `positive` | ポジティブ（ワクワク・お得） |
| `neutral` | 普通（中立・情報整理） |
| `negative` | ネガティブ（恐れ・警告） |

### 軸 3：中身の構造

| ID | 名前 |
|----|------|
| `list` | リスト型 |
| `step` | ステップ型 |
| `compare` | 比較型 |
| `deepdive` | 深掘り型 |
| `story` | ストーリー型 |
| `qa` | Q&A 型 |
| `branch` | ケース分岐型 |

---

## 4. フォーマット一覧（20 種）

| id | 名前 | フック | トーン | 構造 | エンプラ |
|----|------|:--:|:--:|:--:|:--:|
| `f_n_sen` | N 選型 | number | ➕ | list | ◎ |
| `f_ranking` | ランキング型 | number | ➕ | list | ◎ |
| `f_howto_steps` | ハウツー手順型 | promise | ➖ | step | ◎ |
| `f_checklist` | チェックリスト型 | promise | ➖ | list | ◎ |
| `f_what_is` | 用語解説型 | category | ➖ | deepdive | ◎ |
| `f_beginner_guide` | 基礎知識ガイド型 | promise | ➖ | deepdive | ◎ |
| `f_compare` | 比較・VS 型 | category | ➖ | compare | ◎ |
| `f_contrast` | 対比型 | promise | ➖ | compare | ◎ |
| `f_case_branch` | ケース分岐型 | question | ➖ | branch | ◎ |
| `f_ng_pattern` | 失敗・NG 型 | mistake | ➖➖ | list | △ |
| `f_dont_miss_out` | 知らないと損型 | mistake | ➖➖ | list | △ |
| `f_myth_fact` | Myth vs Fact 型 | myth | ➖ | compare | ◎ |
| `f_faq` | Q&A / FAQ 型 | question | ➖ | qa | ◎ |
| `f_quiz` | クイズ型 | question | ➕ | qa | ◎ |
| `f_diagnosis` | 診断型 | question | ➕ | qa | △ |
| `f_story` | 体験談・ストーリー型 | story | ➕ | story | △ |
| `f_arua_aru` | あるある型 | story | ➕ | list | △ |
| `f_diagram_summary` | 図解まとめ型 | promise | ➖ | deepdive | ◎ |
| `f_news` | 時事ニュース型 | category | ➖ | deepdive | ◎ |
| `f_data_explain` | データ解説型 | category | ➖ | deepdive | ◎ |

（➕ positive / ➖ neutral / ➖➖ negative、 ◎ ok / △ caution）

---

## 5. スライドの 3 層スキーマ

各スライドは `zone_top` / `zone_middle` / `zone_bottom` の 3 ゾーンに分割。
各ゾーンには `elements.yaml` or `diagram-gallery.yaml` の要素を配置する。

```yaml
slide:
  zone_top:    { element: heading, limits: {chars: 25, lines: 2} }
  zone_middle: { element: diagram, diagram: compare_before_after }
  zone_bottom: { element: highlight_box, limits: {chars: 60} }
```

「上・中・下」に**何を入れるか**は `templates.yaml` の各テンプレで定義されており、
フォーマット選択 →templates 参照 → 自動で**ゾーンへの要素配置が決まる**。

---

## 6. 枚数制約

- **最大 10 枚**（Instagram 仕様）
- **最小 5 枚**
- **CTA は最終に 1〜2 枚固定で自動追加**（選択不要）
- 本文の枚数は各フォーマットの `min_slides` / `max_slides` に従う

---

## 7. 制作ルールとリスクフラグ

各フォーマットには、制作ルール 14 項目への**抵触可能性**が `risk_flags` として付与されている。
bot は出力時にこのフラグを提示し、**抵触 0 を強制せず**に「可能性の通知」を行う。

リスク重要度：
- **high** — 必ず要確認
- **medium** — 文脈により問題
- **low** — 推奨事項

例：`f_data_explain`（データ解説型）
```yaml
risk_flags:
  - rule_id: rule_03_source   # 国・企業ソース限定
    severity: high
  - rule_id: rule_04_citation # 引用元 URL 必須
    severity: high
```

---

## 8. 品質セルフチェック（17 項目）

出力後、`quality-checklist.yaml` に沿って自動セルフチェックが走る：

| カテゴリ | 項目数 | 自動チェック可 | 人間判断必要 |
|---------|:-:|:-:|:-:|
| 全体の整合性 | 4 | — | 4 |
| スライド内容 | 9 | 1 | 8 |
| ビジュアル面 | 4 | 2 | 2 |

自動検出される代表例：
- `check_13_unified_notation` — NG 表記（×分かる → 〇わかる）の検出
- `check_14_visual_not_text_only` — テキストのみのスライド検出
- `check_16_text_density` — 文字量超過の検出

---

## 9. ドライラン検証

`docs/dry-run.md` 参照。
テストネタを 1 件通して、仕様書通りに構成案が出力されることを確認済み。

---

## 10. 関連ドキュメント

- `docs/app-flow.md` — Web アプリの UX フロー
- `docs/format-catalog.md` — 各フォーマットの詳細カタログ
- `docs/diagram-catalog.md` — 図解ギャラリーの人間向け説明
- `docs/dry-run.md` — 実例検証
