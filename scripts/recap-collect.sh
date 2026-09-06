#!/usr/bin/env bash
# /recap 用の前処理。git から「事実」だけを最小十分情報で集める。
# LLM を通さないので安い。出力を Claude が読んで、図解のスロットを埋める。
#
# 使い方:
#   scripts/recap-collect.sh            # 今日（JST 0:00 以降）
#   scripts/recap-collect.sh 3d         # 直近3日
#   scripts/recap-collect.sh abc123..HEAD
#   scripts/recap-collect.sh abc123     # abc123..HEAD と同じ
set -uo pipefail
export TZ=Asia/Tokyo
spec="${1:-today}"
range=""; since=()
case "$spec" in
  today) since=(--since=midnight) ;;
  *d)    since=(--since="${spec%d} days ago") ;;
  *..*)  range="$spec" ;;
  *)     range="$spec..HEAD" ;;
esac

echo "## 期間: $spec　（生成 $(date '+%Y-%m-%d %H:%M JST')）"
echo "## ブランチ: $(git branch --show-current)"
echo
echo "## コミット（新しい順・最大40）"
git log "${since[@]}" $range --date=format:'%m/%d %H:%M' --pretty='- %ad  %s' | head -40
echo
echo "## よく触ったファイル（上位15）"
git -c core.quotepath=false log "${since[@]}" $range --name-only --pretty=format: | { grep -v "^$" || true; } | sort | uniq -c | sort -rn | head -15 | awk '{printf "- %s ×%s\n", $2, $1}'
echo
echo "## 規模"
n=$(git log "${since[@]}" $range --oneline | wc -l | tr -d ' ')
echo "コミット数: $n"
git log "${since[@]}" $range --shortstat --pretty=format: | awk '
  { for (i=1;i<=NF;i++) { if ($(i+1) ~ /^file/) f+=$i; if ($(i+1) ~ /^insertion/) a+=$i; if ($(i+1) ~ /^deletion/) d+=$i } }
  END { printf "変更ファイル延べ: %d　追加行: +%d　削除行: -%d\n", f, a, d }'
u=$(git status --short | wc -l | tr -d ' ')
[ "$u" != "0" ] && echo "未コミットの変更: ${u}件（図解には含めない）"
exit 0
