# 半自動営業ツールキット

複業クラウド一本だった営業を複数媒体に広げるための、記録・生成・集計のツール群です。

作った理由は2つあります。

1. **応募数が記録されていなかった。** Gmailに届くのは「企業から返信が来た」通知だけで、
   こちらが何件応募したかがどこにも残っていませんでした。そのため 2026年8月の失速が
   「応募先が尽きた」のか「送っているが返ってこない」のか切り分けられませんでした。
2. **面談後の追客が漏れていた。** 面談まで進んだ4件が2〜3週間放置されていました。

どちらも記録があれば防げます。このツールキットは記録を正本にして、そこから応募文の生成と
ファネル集計を行います。

## 自動化の方針

**一括自動応募はしません。** 多くの媒体は規約でスクレイピングやボットによる応募を禁止して
います。ここで自動化するのは次の2つだけです。

- 応募文の**下書き生成**（プロフィールとテンプレートから Claude が書く）
- 応募ログの**集計と追客アラート**

新着案件の発見と実際の送信は手動です。工数はほとんど変わらず、アカウント停止のリスクだけが
消えます。各媒体の方針は `platforms.json` の `automation` に記録してあります。

## セットアップ

```bash
npm install
```

応募文の生成にだけ Claude の認証情報が必要です。`.env.local` に `ANTHROPIC_API_KEY` を設定
するか、`export ANTHROPIC_API_KEY=sk-ant-...` してください。他のコマンドはローカルのファイル
だけで動きます。

## 使い方

### 1. 媒体の状況を見る

```bash
npm run sales -- platforms
```

登録済み／未登録、優先度、自動化方針が出ます。未登録の最優先媒体が下に表示されます。

### 2. 応募したら記録する

**送ったその場で打つのが唯一のルールです。** ここが抜けると全部の集計が壊れます。

```bash
npm run sales -- add \
  --platform kaikoku \
  --company "株式会社サンプル" \
  --title "SNS運用ディレクター" \
  --type sns \
  --rate "時給4,000円・月60h" \
  --url "https://..."
```

`--type` は `sns` / `short-video` / `ad` / `photo`。テンプレートの選択に使います。

### 3. 応募文の下書きを作る

```bash
# 募集要項をファイルで渡す
npm run sales -- draft 12 --jd ./jd.txt

# 直接渡す
npm run sales -- draft 12 --job "$(pbpaste)"
```

`profile.json` の実績と `templates/<type>.md` の方針だけを使って書きます。
プロフィールにない実績は書かせません。生成物は `sales/drafts/` に保存されます。

**そのまま送らないこと。** 下書きです。募集要項との対応を自分で確認してから送ってください。

### 4. 状況を進める

```bash
npm run sales -- set 12 replied --note "面談打診あり"
npm run sales -- set 12 meeting --date 2026-09-02
npm run sales -- set 12 won --note "業務委託基本契約を締結"
```

ステータスは `applied` → `replied` → `meeting` → `won` / `lost` / `ghosted`。
進めた時点の日付が自動で入ります（`--date` で上書き可）。

### 5. 追客漏れを見る

```bash
npm run sales -- stale
```

応募して7日、返信をもらって5日、面談して7日動きがないものを出します。
しきい値は `--applied-days` / `--replied-days` / `--meeting-days` で変えられます。

### 6. 集計する

```bash
npm run sales -- report
npm run sales -- report --weeks 12
```

ファネル全体（応募 → 返信 → 面談 → 成約）、週次推移、媒体別を出します。
**直近2週の応募数がゼロなら警告が出ます。** 8月の失速を早期に検知するための機能です。

## ファイル

| パス | 役割 |
| --- | --- |
| `profile.json` | 実績・稼働条件・単価レンジ。応募文生成の唯一の事実ソース |
| `platforms.json` | 媒体マスタ。登録状況・優先度・自動化方針 |
| `templates/*.md` | 職種別の応募文の書き方 |
| `log/applications.csv` | 応募ログの正本。手で直しても構いません |
| `drafts/` | 生成した応募文 |
| `discord/` | Discord から書き出したメンバー名簿（gitignore 済み） |

## 現在の応募ログについて

初期データとして、2026年7〜8月に**面談まで到達した10件**を入れてあります。
面談に至らなかった24社は、こちらの応募日も先方とのやりとりも記録が残っていないため
入れていません。

そのため今の `report` は返信率・面談化率が100%と出ます。母数が「面談まで行った案件」だけ
だからです。これから `add` で積んでいくと実際の率に収束します。10件の `applied_at` が空
なのも同じ理由で、週次集計からは除外されます。

## Discord メンバー名簿

`scripts/discord-members.mjs` は別系統のツールです。Claude の Discord コネクタが存在しない
ため、Bot トークンで Discord REST API を直接叩きます。

```bash
# Bot が参加しているサーバーとIDを確認
npm run discord:members -- guilds

# メンバー一覧を書き出し（sales/discord/ に .md と .csv）
npm run discord:members -- members --guild <サーバーID>
```

事前に Discord Developer Portal で以下が必要です。

1. Applications → 対象アプリ → Bot → **Reset Token** でトークンを取得し `DISCORD_BOT_TOKEN` に設定
2. 同じ画面の Privileged Gateway Intents で **SERVER MEMBERS INTENT を ON**（これが OFF だと403）
3. OAuth2 → URL Generator で `scope=bot` を選び、生成されたURLからサーバーに Bot を招待

出力はロール階層の高い順に並び、末尾にロール別の一覧が付きます。
