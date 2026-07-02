---
description: 受注案件を処理する — ヒアリング内容から構成案〜納品文書まで一気に生成
---

クライアント案件を処理する。引数: $ARGUMENTS（ヒアリングフォームの回答、またはネタの説明）。

## 手順

1. **入力の確認**: $ARGUMENTS からヒアリング項目（ネタ/ゴール/ターゲット/トーン/NG事項）を読み取る。ネタが無い場合のみユーザーに確認する。空欄項目は業種から常識的に補完し、補完した旨を出力に明記する。

2. **フォーマット選定**: `data/formats.yaml` を読み、3軸（hook/tone/structure）でネタに合う候補を2〜3個選ぶ。ゴール（保存/来店/フォロー）との整合を最優先。選定理由を1行で言語化する。

3. **構成案の生成**: 選定フォーマットの `recipe` に従い、以下を作る:
   - タイトル3案（`title_templates` 準拠。25字以内・おすすめに★）
   - スライド構成表（各スライドの zone_top / zone_middle / zone_bottom。`templates.yaml` の実在テンプレIDを使用し、element/diagram 指定は `elements.yaml` / `diagram-gallery.yaml` の実在IDのみ）
   - 図解・写真指定（`photo_moods` から雰囲気指定）
   - キャプション本文＋ハッシュタグ10個（大中小の検索ボリュームを混ぜる）

4. **品質チェック**: `data/writing-rules.yaml`（14項目）と `data/quality-checklist.yaml`（16項目）に照らして自己チェック。抵触の可能性がある項目はリスクフラグとして明記（修正はせず通知）。NG事項（ヒアリング4）との照合も行う。

5. **納品文書の組み立て**: `business/delivery-template.md` の形式に流し込み、`business/deliverables/<日付>-<クライアント名>.md` として保存する。

6. **次のアクションを提示**: 「構成案確認依頼」の定型文（`business/message-templates.md` §2）に今回の内容を差し込んだ送信用テキストも出力する。

## 注意

- クライアント名・案件内容は `business/deliverables/` 以外に書かない
- 実在しないID（テンプレ/要素/図解/ルール）を出力しない。迷ったら Grep で確認
- 文字数制限（elements.yaml の text_limit_chars）を厳守
