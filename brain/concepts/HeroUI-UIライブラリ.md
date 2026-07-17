# HeroUI（React UIライブラリ）— 道具ノート

一言で: **旧NextUI。React用の「きれい・速い・モダン」なUIコンポーネント集。** 2025年1月にNextUIから改名（Next.js専用と誤解されるため）。
出典: InfoQ / 公式 v2.heroui.com（2026-07リサーチ）。

## なぜ半歩先か（多くの人が知らない点）
- **2026年3月に v3 が“全面書き直し”で登場**。Web用75+コンポーネント（新規21）＋**React Native版37**を新設 → **Web/ネイティブを1つのデザインシステム**で組める
- 土台が **React Aria（アクセシビリティ）＋ Tailwind CSS v4**。React 19 / Next.js とそのまま動く
- **`<Provider>` ラッパー不要**、複合コンポーネントAPI（`Card.Header` / `Card.Content` / `Select.Item` …）で書き味が素直
- 更新が活発（v3.2.0が2026-06-16、以降**毎月マイナー更新**が公式方針）

## あなたの事業でどう効く
- このリポジトリは **Next.js 14 + Tailwind**。HeroUIは相性が良く、**受注案件のUIを短時間でプロっぽく**仕上げられる（= 出荷スピードが上がる）
- Canva生成物の「Web版納品」や、クライアント向けの簡易ツール画面を素早く作れる
- v3のNative対応で、将来スマホアプリUIまで同じ知識で伸ばせる

## 最短の使い方（Next.jsで）
```bash
npm i @heroui/react framer-motion   # v2系。v3はTailwind v4前提なので要確認
# tailwind.config に heroui() プラグインを追加、globals.css で読み込む
```
```tsx
import { Button, Card } from "@heroui/react";
<Card><Card.Header>タイトル</Card.Header><Card.Content>本文</Card.Content></Card>
```
- **v2**（`v2.heroui.com`）が安定版。**v3**はTailwind v4必須なので、既存プロジェクトに入れる時はTailwindのバージョンを先に確認する
- 迷ったら: 管理画面・フォーム・ダッシュボード系はHeroUIが速い。凝ったLPは自前Tailwindの方が自由

## 立ち位置（他ライブラリとの違い）
- **shadcn/ui**: コードをコピーして所有（カスタム自由・自己責任）。**HeroUI**: パッケージで導入（速い・統一感）。**MUI**: 重厚・企業向け
- 「速く・きれいに・アクセシブルに」出したいならHeroUI、「隅々まで作り込む」なら自前Tailwind/shadcn

## 出典
- InfoQ: HeroUI v3 Lands as a Ground-Up Rewrite（2026-07）
- 公式: v2.heroui.com / github.com/heroui-inc/heroui
