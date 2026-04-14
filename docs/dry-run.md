# ドライラン検証

仕様書通りに構成案が出せるかを、テストネタ 1 件で検証。

---

## 入力

```yaml
ネタ:
  本文: "住宅ローンの金利タイプ（変動 / 固定 / ミックス）の選び方を解説したい"
  ターゲット: "30〜40代のこれから家を買う人"
  ゴール: "保存してもらい、検討時に見返してもらう"
  参照: null
```

---

## [Step 1] フォーマット選択（3 軸フィルタ）

**軸入力**：
- フック：`question`（「どれを選ぶ？」で入る）
- トーン：`neutral`（中立の解説）
- 構造：`branch`（状況別に推奨）

**絞り込み結果**：
- `f_case_branch` ケース分岐型（軸完全一致）
- `f_compare` 比較・VS 型（構造 compare も近い）
- `f_faq` Q&A / FAQ 型（フック question の別候補）

**ユーザー選択**：`f_case_branch` ケース分岐型

---

## [Step 2] 推奨図解

`f_case_branch` の recipe から推奨される図解：

| スライド役割 | 推奨図解 |
|-------------|---------|
| 全体像 | `compare_table_row` |
| 前提整理 | `cards_2x2` |
| ケース別選択肢 | `compare_3_column` or `compare_before_after` |
| 推薦 | `recommend_by_case` |

---

## [Step 3] 自動生成（9 枚構成）

### タイトル案 3 つ

フォーマットの `title_templates` に従い生成：

1. **ケース別 住宅ローン金利タイプの選び方**
2. **変動？固定？あなたならどうする？金利タイプの判断基準**
3. **状況別おすすめ 住宅ローン金利タイプ**

---

### スライド構成（9 枚）

#### [1] 表紙 — `tpl_cover_question`
```
zone_top:    [category_pill] 「住宅ローン」
zone_middle: [main_title]    「あなたならどう選ぶ？
                              金利タイプの判断基準」
             背景写真:        scenery「家の外観（遠景）」
zone_bottom: [logo]
```
**文字数**：カテゴリ 6 字 / タイトル 22 字（2 行）

---

#### [2] 全体像 — `tpl_intro_compare_table`
```
zone_top:    [heading]   「金利タイプは大きく 3 種類」
zone_middle: [diagram]   compare_table_row
             行：変動／固定／ミックス
             列：特徴／向く人／リスク
zone_bottom: [question]  「あなたはどれが合う？」
             [highlight_box] 「今回は 3 タイプのケース別に整理します。」
```

---

#### [3] 前提整理 — `tpl_item_cards_2x2`
```
zone_top:    [heading] 「選ぶときに考えたい 4 つの観点」
             [lede]    「以下の軸で自分の状況を整理しましょう。」
zone_middle: [diagram] cards_2x2
             ① 返済期間の長さ
             ② 家計の余裕度
             ③ 金利上昇への耐性
             ④ ライフプランの変化
zone_bottom: [outro]       「次のスライドからケース別に見ていきます。」
             [footer_next] 「ケース①：短期で返済したい ▶」
```

---

#### [4] ケース 1 — `tpl_item_cards_3`
```
zone_top:    [label_tag] 「ケース 1」
             [heading]   「短期返済・金利上昇に強い家計」
             [lede]      「返済期間が短く、金利が上がっても耐えられる場合。」
zone_middle: [diagram]   compare_3_column
             ・変動金利：メリット大（金利最低水準）
             ・固定金利：コスト高になりやすい
             ・ミックス：部分的に固定でヘッジ
zone_bottom: [caption]       「詳しくはキャプションに記載しています。」
             [highlight_box] 「→ 変動金利が向きやすいケース。」
             [footer_next]   「ケース②：長期返済・リスク回避型 ▶」
```

---

#### [5] ケース 2 — `tpl_item_cards_3`
```
zone_top:    [label_tag] 「ケース 2」
             [heading]   「長期返済・リスク回避したい家計」
zone_middle: [diagram]   compare_3_column
             ・変動金利：返済額増加リスク
             ・固定金利：返済計画が立てやすい
             ・ミックス：一部変動で将来の低金利メリットも狙える
zone_bottom: [highlight_box] 「→ 固定金利 or ミックスが向くケース。」
             [footer_next]   「ケース③：途中でライフイベントが重なる ▶」
```

---

#### [6] ケース 3 — `tpl_item_cards_3`
```
zone_top:    [label_tag] 「ケース 3」
             [heading]   「ライフイベントが重なる家計」
zone_middle: [diagram]   compare_3_column
             ・変動金利：子育て期に金利上昇すると負担増
             ・固定金利：見通し立てやすいが金利高め
             ・ミックス：柔軟に対応可能
zone_bottom: [highlight_box] 「→ ミックスが向く可能性。」
             [footer_next]   「ケース別おすすめまとめ ▶」
```

---

#### [7] 推薦まとめ — `tpl_summary_recommend`
```
zone_top:    [heading] 「ケース別 おすすめ金利タイプ」
zone_middle: [diagram] recommend_by_case
             ケース①「短期・余裕あり」
               → 変動金利
                 ・金利最低水準のメリット活用
                 ・余裕分で繰上返済
             ケース②「長期・安定志向」
               → ①固定金利
                   ・返済計画の見通し
                 ②ミックス
                   ・一部固定でヘッジ
             ケース③「ライフイベント多」
               → ミックス
                   ・期間別に柔軟対応
zone_bottom: [footer_next] 「SWIPE ▶」
```

---

#### [8] CTA（固定） — `tpl_cta_phone` ＋ `cta_follow` + `cta_save`
```
zone_top:    [heading] 「不動産やお金に関するお役立ち情報を発信中！」
zone_middle: [phone_mockup] Instagram プロフィール
             side_card: 「フォローして最新情報を GET！」
zone_bottom: [caption] 「いつでも見返せるように保存！」
```

---

#### [9] （オプション）プロフィール HP 誘導 — `cta_profile_hp`
商品詳細訴求があるなら、キャプション末尾に追加：
```
▼商品への問い合わせ、商品詳細はこちら
プロフィール URL「セゾンファンデックス公式 HP」
```

---

## [Step 4] セルフチェック結果

| 項目 | 結果 |
|------|:-:|
| `check_01_cta_match`：構成がフォーマットの recipe と一致 | ✅ |
| `check_02_flow_natural`：表紙→導入→本文→まとめ→CTA の順 | ✅ |
| `check_03_target_clear`：ターゲット（30〜40代）明確 | ✅ |
| `check_06_intro_empathy`：2 枚目に compare_table_row を配置 | ✅ |
| `check_10_accuracy_source`：統計・数値の出典 | ⚠ **未入力**（金利水準データを引用するなら出典必須） |
| `check_13_unified_notation`：NG 表記検出 | ✅ |
| `check_14_visual_not_text_only`：全スライドに diagram / photo あり | ✅ |
| `check_16_text_density`：文字数上限遵守 | ✅ |
| `rule_03_source`：個人ブログ引用なし | ✅ |
| `rule_08_saison`：「セゾン」単独使用なし | ✅ |
| `rule_09_institution_check`：制度の最新性 | ⚠ **要確認**（金利タイプは制度ではないが税制優遇等に触れるなら要確認） |
| `rule_13_photo`：悲壮感なし・遠景／物体のみ | ✅ |

**合格 10 / 12 項目**。⚠ 2 件：出典記載と制度最新性の確認要。

---

## 結論

仕様書（`elements.yaml` + `templates.yaml` + `diagram-gallery.yaml` + `formats.yaml` + `writing-rules.yaml` + `quality-checklist.yaml`）に基づいて、**実際の構成案が機械的に生成可能**であることを確認。

ゴール（ネタ投入 → フォーマット選択 → 構成案自動出力）が仕様レベルで成立している。

---

## 発覚した改善点

1. ✅ 文字数ヒント：各ゾーンの文字数上限をドライラン出力にも添えるのが良い（現仕様でも `limits` として取得可能）
2. ✅ セルフチェック結果の提示形式：合格数 / 要確認数の集計を付けると UX が良い
3. 🔧 `写真指定 + photo_mood + 実際の候補検索クエリ` を自動生成する仕組みが次フェーズで必要（今は雰囲気指定止まり）
4. 🔧 キャプション本文のテンプレも別途辞書化が必要（format-spec.md ではまだ扱っていない）

→ これらは MVP 実装時に追加する改善項目として記録。
