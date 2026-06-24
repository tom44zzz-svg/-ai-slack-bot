---
name: content-data
description: data/*.yaml のコンテンツ辞書（formats / templates / elements / diagram-gallery / writing-rules / quality-checklist / cta-patterns）を編集・拡張・検証するためのガイド。YAML辞書の追加・変更・整合性チェックを行うときに使う。
---

# コンテンツ辞書（data/*.yaml）の編集ガイド

このアプリのロジックの大半はコードではなく `data/` の YAML 辞書に宿る。辞書は **id で相互参照**しているため、編集時は参照整合性を必ず保つ。

## 正本ファイルと参照関係

| ファイル | 内容 | 参照 |
|---|---|---|
| `formats.yaml` | 投稿フォーマット（3軸 + recipe + risk_flags） | `recipe[].template_options` → templates.yaml / `risk_flags[].rule_id` → writing-rules.yaml |
| `templates.yaml` | スライドテンプレ（zone_top/middle/bottom の3層） | `zone_*.element` → elements.yaml / `zone_*.diagram` → diagram-gallery.yaml |
| `elements.yaml` | 要素（text_elements / visual_elements / photo_moods） | （末端） |
| `diagram-gallery.yaml` | 図解タイプ（ASCIIプレビュー付） | （末端） |
| `writing-rules.yaml` | 制作ルール（severity / detection 付き） | （末端） |
| `quality-checklist.yaml` | 品質チェック項目 | （末端） |
| `cta-patterns.yaml` / `source-posts.yaml` | CTA / 分析元投稿 | （末端） |

## 編集の鉄則

1. **末端（elements / diagram / writing-rules）→ 中間（templates）→ 上位（formats）** の順で足す。参照先を先に作る。
2. `id` はスネークケース。既存の命名（`tpl_*`, `f_*`, `rule_NN_*` 等）に合わせる。
3. `name` / `note` など人間向け文字列は**日本語**で書く。
4. 変更後は**必ず**検証を走らせる:
   ```bash
   node scripts/validate-data.mjs
   ```
   これは `data/*.yaml` 編集時に PostToolUse フックでも自動実行される。
5. 辞書を変えたら `docs/`（`format-catalog.md`, `diagram-catalog.md` 等）の人間向けカタログとの齟齬も確認する。

## よくある失敗

- templates の `template_options` に、まだ存在しない tpl id を書く → 検証で「未定義の template」エラー。
- formats の `risk_flags.rule_id` のタイポ → 「未定義の rule_id」エラー。
- `enterprise_caution` を ok/caution/avoid 以外にする、`axes.tone` を positive/neutral/negative 以外にする → 仕様逸脱（人手で確認）。
