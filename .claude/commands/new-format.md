---
description: 新しい投稿フォーマットを data/formats.yaml に追加するのを支援する
---

新しい投稿フォーマット（`formats.yaml` の1エントリ）の追加を手伝う。引数: $ARGUMENTS（追加したいフォーマットの概要）。

手順:
1. `data/formats.yaml` の既存エントリを2〜3個読み、スキーマ（id / name / one_liner / axes{hook,tone,structure} / min_slides / max_slides / recipe[] / title_templates / risk_flags / enterprise_caution / example_topics）を把握する。
2. ユーザーの概要から各フィールドの草案を作る。
   - `axes.hook` は elements.yaml の軸値、`tone` は positive/neutral/negative、`structure` は list/step/compare/deepdive/story/qa/branch から選ぶ。
   - `recipe[].template_options` は **templates.yaml に実在する id** だけを使う。
   - `risk_flags[].rule_id` は **writing-rules.yaml に実在する id** だけを使う。
3. 新しい id を提案する前に、参照先が実在するか Grep で確認する。
4. `data/formats.yaml` に追記する。
5. **必ず** `node scripts/validate-data.mjs` を実行して整合性を確認する（壊れた参照があれば直す）。
6. 関連ドキュメント（`docs/format-catalog.md` 等）との齟齬があれば指摘する。
