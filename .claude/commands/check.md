---
description: lint + build + データ辞書の整合性チェックを一括実行する
allowed-tools: Bash(npm run lint:*), Bash(npm run build:*), Bash(node scripts/validate-data.mjs)
---

このリポジトリの健全性を一括チェックする。次を順に実行し、結果を簡潔に報告:

1. `node scripts/validate-data.mjs` — data/*.yaml の構文 + ID相互参照
2. `npm run lint` — ESLint
3. `npm run build` — 本番ビルドが通るか

いずれか失敗したら、原因のファイルと修正方針を提示する。全部通ったら「✅ all green」と報告。
