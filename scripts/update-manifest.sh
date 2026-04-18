#!/bin/bash
# 参考画像の manifest.json を自動生成するスクリプト。
# public/references/ 内の画像ファイル（png/jpg/jpeg/webp）を走査して
# manifest.json を出力する。
#
# 使い方:
#   1. 画像を public/references/ に配置
#   2. bash scripts/update-manifest.sh
#   3. git add public/references/ && git commit && git push

set -euo pipefail
cd "$(dirname "$0")/.."

DIR="public/references"
OUT="$DIR/manifest.json"

echo '{ "images": [' > "$OUT"

first=true
for f in "$DIR"/*.{png,jpg,jpeg,webp,PNG,JPG,JPEG,WEBP} 2>/dev/null; do
  [ -f "$f" ] || continue
  name="$(basename "$f")"
  # ファイル名からカテゴリを推定
  # 命名規則:
  #   cover_*.png        → category: cover
  #   diagram_*.png      → category: diagram
  #   item_*.png         → category: item
  #   cta_*.png          → category: cta
  #   intro_*.png        → category: intro
  #   summary_*.png      → category: summary
  #   その他             → category: general
  category="general"
  case "$name" in
    cover_*|表紙_*)       category="cover" ;;
    diagram_*|図解_*)     category="diagram" ;;
    item_*|項目_*)        category="item" ;;
    cta_*|CTA_*)          category="cta" ;;
    intro_*|導入_*)       category="intro" ;;
    summary_*|まとめ_*)   category="summary" ;;
  esac

  if [ "$first" = true ]; then
    first=false
  else
    echo ',' >> "$OUT"
  fi
  echo "  {\"filename\": \"$name\", \"path\": \"/references/$name\", \"category\": \"$category\"}" >> "$OUT"
done

echo '' >> "$OUT"
echo '] }' >> "$OUT"

count=$(grep -c '"filename"' "$OUT" 2>/dev/null || echo 0)
echo "manifest.json updated: $count images found"
