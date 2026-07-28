# 最適化チェックリスト（スマホから実行できる版）

Claude Code のコンテキスト（会話枠）がすぐ満杯になる問題と、承認オペの最適化。
2026-07-28 の棚卸しで洗い出した項目。**上から順に効果が大きい。**

> ⚠️ この文書の①〜⑤は Claude（エージェント）側からは変更できない。
> Routine の設定変更は Claude アプリの UI 操作が必要なため、**スマホから手で行う**。

---

## ① 毎日レッスンを「毎回新規セッション」にする ★最優先

**症状**: 会話コンテキストがすぐ満杯になる。

**原因**: Routine「AIエージェント習得 毎日レッスン」だけ、他と設定が違う。

| 項目 | 値 |
|---|---|
| Routine ID | `trig_01Bzx6bCAmDgebAw4PxfNYZN` |
| `persist_session` | `true` ← **これが原因** |
| `persistent_session_id` | `session_01R5bjwdWV9fT48FNsVsAh6U` |

毎晩22:30のレッスンが**新しい会話ではなく、同じ1本の会話に追記され続ける**。
14日分の図解生成・Web検索・レッスン本文が全部同じコンテキストに蓄積している。
他の6つの Routine は `session_id: ""`（毎回新規）なので問題なし。

**対処**: この Routine を「毎回新規セッションで実行」に変更する。

**継続性は失われない**: ストリーク・宿題・予告は `brain/learning/progress.md` に
保存済み（＝手動RAG）。会話が毎日リセットされても `/lesson` がファイルを読むので継続する。

---

## ② 各 Routine から使っていない MCP を外す

**症状**: 毎回の起動が重い・遅い・高い。

**原因**: 7本すべての Routine に MCP が8個ぶら下がっている。

- Canva / Notion / Gmail / Google Calendar / Slack / vidIQ / freee / Google Drive
- 合計 **162個のツール定義**を毎回ロードしている

しかし各 Routine の `allowed_tools` は **Bash / WebSearch / WebFetch / Read / Write のみ**。
→ **162個ロードして、1つも使っていない。**

Day9「MCP繋ぎすぎ → context rot」の実地版。

**対処**: 以下の Routine から MCP 接続を全部外す（どれも Web 検索と執筆しかしない）。

| Routine | ID |
|---|---|
| 禁書ノオト・PM日報 | `trig_01UNpXWUbEZ7MrUj6jaJ4VPe` |
| 禁書ノオト・PM月報 | `trig_011LSJgrPBY5SgRAYij84nGW` |
| GGG週次レポート | `trig_01FT4NsLqh7pMGoNJXZkFboV` |
| GGG月次レポート | `trig_01UtzFpnPmsP2Yp8M3EDEKaD` |
| 週次ショート動画リサーチ | `trig_0196YFDKY1ZrvZMkRcypox75` |
| weekly-ai-report | `trig_01NN69GSY1W2f8bgBZgs81GA` |
| ウィークリーAIニュース | `trig_01GvLH5XKcSbdPN4iXjAudXc` |

---

## ③ freee の接続を外す

freee MCP は**認証切れのまま**（セッション中も未接続のまま）。
会計連携を今使っていないなら、全 Routine の接続リストから外す。
使うときだけ繋ぎ直す運用にする。

---

## ④ 週次 AI ニュースを1本に統合

内容がほぼ重複している：

| Routine | スケジュール | 出力先 |
|---|---|---|
| `weekly-ai-report` | 日 20:00 | Discord Webhook |
| `ウィークリーAIニュース` | 月 09:00 | チャット |

**対処**: どちらか1本に集約し、もう1本は無効化する。

---

## ⑤ 禁書ノオト PM日報の頻度を見直す

日報プロンプト自体が「月内サイクル・週内サイクル（曜日別）」で動く設計。
つまり**曜日で決まった内容**が多く、毎日フル生成する必要は薄い可能性がある。

**判断基準**: 毎朝ちゃんと読んで動いているか？
- 読んでいる → **維持でOK**
- 溜めている → 隔日／週次、または「投稿期（22〜23日）だけ毎日」に絞る

---

## ⑥ スマホ承認まわりの設定（要・本人適用）

> 📄 適用ファイルは **`docs/mobile-approval-settings.json`** に用意済み。
> 中身を `~/.claude/settings.json` にコピーすれば全プロジェクトに効く。

### ★ 本命は権限リストではなく、この3つ

「スマホで承認できるように」の核心は permissions ではなく通知設定だった：

| 設定キー | 効果 |
|---|---|
| `inputNeededNotifEnabled: true` | **承認プロンプト待ちのときスマホにプッシュ通知**（これが本命） |
| `agentPushNotifEnabled: true` | Claude からの能動的なスマホ通知を許可 |
| `askUserQuestionTimeout: "never"` | 未回答でも勝手に進めず、承認を待ち続ける |

`~/.claude/settings.json`（ユーザーレベル）に置けば**すべてのプロジェクトに適用**される。
プロジェクトごとの `.claude/settings.json` に書く必要はない。

### 権限の考え方（3層）

**方針**: スマホでのタップ承認を「必要な時だけ、確実に出す」形にする。

| 分類 | 扱い | 理由 |
|---|---|---|
| 安全な読み取り・定型作業 | `allow`（無音で通す） | 無駄なタップを減らす |
| 危険だが必要な操作 | `ask`（タップ承認を出す） | **スマホで承認できる = 狙い通り** |
| 秘密情報 | `deny`（完全禁止） | 承認の余地を残さない |

つまり `ask` に残すのは正しい。危険操作こそスマホに出したいため。
削るべきは「毎回聞かれるが実は安全」なもの。

### `.claude/settings.json` の allow に追加したい候補

現状 `allow` に無いため毎回プロンプトが出て、スマホでのタップが増えているもの：

```
"Bash(git commit:*)",          ← ローカルのみ・取り消し可
"Bash(git branch:*)",
"Bash(git checkout:*)",
"Bash(git switch:*)",
"Bash(git fetch:*)",
"Bash(git rev-parse:*)",
"Bash(git show:*)",
"Bash(git remote:*)",
"Bash(npm install:*)",         ← 現状は完全一致 "npm install" のみ
"Bash(node scripts/render-lesson.mjs:*)",   ← レッスン図解のPNG化
"Bash(node scripts/morning-digest.mjs:*)",
"Bash(ls:*)", "Bash(wc:*)", "Bash(fc-list:*)"
```

### deny に追加したい候補

```
"Read(./**/.env)",
"Read(./**/.env.*)",
"Read(./business/deliverables/**)"   ← 機密（git管理外）
```

### `ask` は現状維持（スマホ承認を出したいので正しい）

```
git push / git reset --hard / git clean / rm -rf / curl / npx
```

> **注**: この変更はエージェントの安全機構により Claude 自身では適用できない
> （自分で自分の権限を書き換えられない仕組み）。本人が適用する必要がある。

---

## ⑦ 補足：セキュリティ

`weekly-ai-report` の Routine プロンプト内に **Discord Webhook URL が平文**で入っている。
これは「そのチャンネルに書き込める鍵」なので、環境変数化を推奨。
（今回の最適化の主題ではないが、Routineを編集するついでに対応できる）

---

## 触らなくてよいもの（無駄ではない）

- **SessionStart の `npm install`** … Web セッションはコンテナ使い捨てなので必要。
  `--no-audit --no-fund` 済みで既に軽量。
- **PostToolUse の YAML 検証** … データ辞書の整合性担保。妥当。
- **Stop hook の git 強制** … 進捗の揮発対策。①の教訓そのもの。
