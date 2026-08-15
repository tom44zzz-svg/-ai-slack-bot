# 環境：Mac操作設定（Karabiner + Hammerspoon + AutoRaise）

Mac のキーボード操作・ウィンドウ操作の環境。**正本はこのファイル。**
実体は `~/.hammerspoon/init.lua`（Mac のローカル。このリポジトリには入っていない）。

> ⚠️ Claude はクラウドのコンテナで動くため、**Mac のファイルは読めない・書けない**。
> 変更するときは、本人がターミナルで実行する形になる。

## 構成

```
Caps Lock ──[Karabiner-Elements]──▶ Hyper（⌘⌥⌃⇧ 同時押し）
                                        │
                                        ▼
                              ~/.hammerspoon/init.lua
                              「Hyper + 何か」で何をするかを定義
```

- **Karabiner-Elements** … キーの変換のみ担当（Caps Lock → Hyper、Caps+矢印 → F13〜F16）
- **Hammerspoon** … 実際の動作を定義。ログイン時に自動起動（`hs.autoLaunch(true)`）
- **Rectangle** … ウィンドウ配置の実行エンジン。Hammerspoon から URL スキームで命令
- **AutoRaise** … マウスを乗せたウィンドウを自動で前面化

## ホットキー一覧（2026-08-15 時点）

| キー | 動作 |
|---|---|
| Caps + ←→↑↓ | 左半分 / 右半分 / 最大化 / 中央寄せ（Rectangle） |
| Caps + 1 / 2 | 左2/3 / 右1/3 |
| Caps + F | 案件一覧フォルダ |
| Caps + C / D / S | Chrome / Discord / Slack |
| Caps + W | 仕事開始モード（Gmail・カレンダー・Timebox・各アプリ一括） |
| Caps + P | 編集モード（Premiere・案件フォルダ・Discord） |
| Caps + K | 経理モード（経理フォルダ・freee・Gmail） |
| **Caps + A** | **AutoRaise の ON/OFF** |
| Caps + R | Hammerspoon 設定の手動リロード |
| ⌘W / ⌘⇧T（Finder時のみ） | 閉じたフォルダの記録 / 復元 |

## AutoRaise は 2プロセス構成

ここを誤解すると必ずハマる。

| パス | 役割 |
|---|---|
| `/Applications/AutoRaise.app/Contents/MacOS/AutoRaise` | **メニューバー担当**（🎈アイコン） |
| `/Applications/AutoRaise.app/Contents/Resources/AutoRaise` | **実行エンジン**（実際に前面化する） |

**両方動いていて初めて正常。** そして厄介なことに、**片方だけを起動する方法では必ず片手落ちになる**。

| やり方 | 結果 |
|---|---|
| `open -a AutoRaise`（アプリ本体だけ） | 🎈は出るが**前面化が働かない** |
| エンジンを直接叩くだけ | 前面化は働くが**🎈が出ない** |
| **両方を明示的に起動** | ← これが唯一の正解 |

- ⚠️ **アプリ本体は、エンジンを起動してくれない。**（2026-08-15 に実測して確認）
  「本体を立ち上げれば中身も動く」と思い込むと、丸ごと1回ハマる
- エンジンだけを殺すと、アプリ本体も一緒に終了する（この方向は連動する）
- `open -a` は**すでに起動中のアプリには何もしない**。オフ→オンで作り直すときは、
  先に `pkill` してからでないと素通りする
- 設定ファイル（`~/.AutoRaise` / `~/.config/AutoRaise/config`）は**存在しない**。
  起動引数の `-delay 1 -focusDelay 0 -mouseDelta 0 -pollMillis 50 -disableKey control` は
  **すべてデフォルト値**なので、カスタム設定は失われていない
  - **`-disableKey control`** … Control を押している間だけ一時的に無効（デフォルト）

## 2026-08-15 に直した不具合

**症状**: Caps+A でオフにするとメニューバーから🎈が消え、オンに戻しても復活しない。

**原因は2つ。どちらも同じ種類の罠だった。**

### ① 起動しているプロセスが違った

Caps+A のオン処理が `Contents/Resources/AutoRaise`（エンジン）だけを直接起動していて、
`Contents/MacOS/AutoRaise`（メニューバー担当）を**一度も起動していなかった**。
→ アイコンは構造上、二度と戻らない状態だった。

**直し方**: `open -a AutoRaise` でアプリ本体から起動する。

### ② ★Hammerspoon のオブジェクトを `local` で持つと止まる

**これが本質。今後も必ず踏む。**

`hs.timer` / `hs.pathwatcher` / `hs.menubar` などを `local` 変数で受けると、
チャンク実行後に **Lua のガベージコレクションで回収され、動作が止まる**。
エラーは出ない。**静かに死ぬ**ので原因が分かりにくい。

実際に2箇所で起きていた:

- `local watcher = hs.pathwatcher.new(...)` … 「保存したら自動リロード」が死んでいた
  （ファイル冒頭のコメントには「保存するだけで反映される」と書いてあるのに、実際は動いていなかった）
- 追加した `hs.timer.doEvery(...)` … 戻り値を捨てていたため1回で停止

**ルール: タイマー・ウォッチャー・メニューバーは `local` を付けずグローバルで持つ。**

## 現在の Caps+A / メニューバー表示の実装

`init.lua` 末尾の2ブロック（マーカーで囲ってある）:

- `-- AUTORAISE_MENUBAR_BLOCK` … メニューバーに 🎈（ON）/ 🚫（OFF）を表示。クリックで切替。
  2秒ごとに状態を見て表示を同期
- `-- AUTORAISE_HOTKEY_BLOCK` … Caps+A。メニューバーのクリックと**同じ処理**（`arToggle()`）を通す

切替の実体は `~/bin/autoraise-toggle.sh`。**アプリ本体（純正🎈）は常に落とし、エンジンだけを起動/停止する。**

```bash
pkill -f "…/Contents/MacOS/AutoRaise"        # 純正アイコンは出さない
if pgrep -f "…/Contents/Resources/AutoRaise"; then
  pkill  …/Resources/AutoRaise               # OFF
else
  nohup …/Resources/AutoRaise -delay 1 … &   # ON
fi
```

**なぜ純正アイコンを出さないか**: エンジンをこちら側で直接起動しているため、
アプリ本体はその状態を知らない。**🎈がオフ表示のまま固まり、嘘をつく。**
状態を持っているのは Hammerspoon 側だけなので、表示も1つに寄せる。

**表示と実処理が1本化されているので、どちらから操作してもズレない。**

### 判定は必ずエンジンで行う

`pgrep -f '[R]esources/AutoRaise'` … `[R]` はブラケットのトリック。
`pgrep` を実行しているシェル自身にマッチさせないため。
アプリ本体（`MacOS/`）の有無を見ると、**機能がオフでもONと表示してしまう**。

外すときは、マーカーで囲まれたブロックごと削除して `hs.reload()`。

## トラブル時の見方

| 症状 | 最初に見る場所 |
|---|---|
| ホットキーが効かない | Console（🔨 → Console）。`-- Loading` の**時刻が古ければ再読み込みされていない** |
| 同じキーが2回登録されている | Console の `Enabled hotkey ✧A` が2回出ていないか |
| 設定を変えたのに反映されない | `hs.reload()` を打つ。pathwatcher が死んでいる可能性 |
| AutoRaise の状態が分からない | `ps aux \| grep -i autoraise`。**パスで役割を見分ける**（上の表） |

> 📌 アクティビティモニタで `autoraise` を検索すると、**無関係な `Autoupdate` も引っかかる**。
> 数だけ見て判断しないこと。

## 関連

- `concepts/ハーネスエンジニアリング.md` … 「静かに壊れるものを、どう検知可能にするか」という同じ問題意識
