# Fable が止まったときに止まらない設定

調べた結果、**「止まる」には2種類あって、効く設定が別**でした。片方は私が入れました。もう片方はあなたのタップが要ります。

調査日 2026-09-14 / Claude Code 2.1.270（実物のバイナリとヘルプを見て確認）

---

## 止まり方は2種類ある

| | 何が起きるか | 画面に出る文言 | 効く設定 |
|---|---|---|---|
| **① 高負荷・利用不可** | Fable 側が混んでいて応答しない | `Fable is experiencing high load, please use /model to switch to Sonnet` | **`fallbackModel`** ← 入れました |
| **② 利用上限** | 自分の枠を使い切った | `利用制限に達しました` | **`autoContinueAtUsageLimit`** ← あなたのタップ |

**①の設定は②には効きません。** `--fallback-model` の説明は
「when the default model is **overloaded or not available**」で、
内部でも `model_not_found` / `permission_denied` / `server_error` のときにしか発火しません。
上限は別枠なので、ここを混同すると「設定したのに止まった」になります。

---

## ① もう入れました（このリポジトリ）

`.claude/settings.json` に2行目として追加し、push 済みです。

```json
"fallbackModel": "opus"
```

- **効く範囲**: このリポジトリで動くセッション全部。あなたが手で開くものも、Routine が起こすものも
- **仕組み**: 起動時に `--fallback-model` として渡される。Fable が落ちたら Opus に逃げ、
  **次のターンの頭で毎回 Fable に戻そうとする**（ずっと Opus に居座らない）
- `opus` はエイリアスで、いまは Opus 5 を指します。将来 Opus が更新されても追随するように、
  `claude-opus-5` と固定書きにはしていません

> 値が同じだと `Fallback model cannot be the same as the main model` で弾かれます。
> Opus で作業しているセッションでは、この設定は無視されるだけで害はありません。

### 「すべてのプロジェクト」について

あなたのリポジトリは**3つだけ**で、実質1つしか動いていません。

| リポジトリ | 最終 push | 状態 |
|---|---|---|
| `-ai-slack-bot` | 2026-09-14 | **これ。設定済み** |
| `feed-post-generator` | 2026-04-14 | 5か月動いていない |
| `ai-slack-bot` | 2026-03-26 | 半年動いていない |

**今日の1件で、実際に使っている分はカバーできています。** 残り2つを起こすときは、
`.claude/settings.json` に同じ1行を足してください（私はいまその2つに手が届きません）。

---

## ② あなたのタップ（1分・これが本命）

**あなたが実際にぶつかっていたのは②のほうです。**
9/14 に iOS から動かした2セッションが上限で失敗し、作業中にも1回止まっています。

Claude Code で **`/config`** を開く
→ **「Model & output」** のあたり
→ **`autoContinueAtUsageLimit`** をオンにする

説明文はこうなっています（実物から抜粋）:

> When a claude.ai usage limit stops your session, **wait for the limit to reset and continue the task automatically.**
> When off, the limit dialog offers the wait as a choice instead.

つまり**モデルを替えるのではなく、枠が戻るまで待って勝手に続きをやる**。
「止まるのもったいない」への答えとしては、こちらのほうが素直です。
寝ている間に上限に当たっても、朝には進んでいます。

同じ画面で、ついでに入れておくといいもの:

| キー | なぜ |
|---|---|
| `inputNeededNotifEnabled` | **承認待ちでスマホに通知**（`docs/mobile-approval-settings.json` の本命。ずっと未適用） |
| `askUserQuestionTimeout` → `never` | 未回答で勝手に進めない |

---

## やらなかったこと

- **Routine のモデルを Opus に固定する。** 11本すべて `model` 未設定＝既定を継いでいます。
  固定すると Fable が元気なときも Opus を焼くので、上限に**早く**当たります。逆効果です
- **`~/.claude/settings.json` にここで書く。** この環境の `~` は使い捨てのコンテナなので、
  書いても次のセッションには残りません。②が「あなたのタップ」なのはこれが理由です
