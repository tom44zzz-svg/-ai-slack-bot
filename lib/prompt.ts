import { Format, Template, Rule } from "./data-loader";

/**
 * LLM に渡すシステムプロンプトと、ユーザーメッセージを組み立てる。
 * フォーマットの recipe を展開して、各スライドで使えるテンプレを明示する。
 */
export function buildPrompt(args: {
  topic: string;
  target?: string;
  goal?: string;
  format: Format;
  templates: Template[];
  rules: Rule[];
  useWebSearch?: boolean;
}): { system: string; user: string } {
  const { topic, target, goal, format, templates, rules, useWebSearch } = args;

  // recipe に登場する template_options をフラット化
  const usedTemplateIds = new Set<string>();
  for (const step of format.recipe) {
    step.template_options?.forEach((id) => usedTemplateIds.add(id));
  }
  const usedTemplates = templates.filter((t) => usedTemplateIds.has(t.id));

  // 重要度 high のルールのみ提示（情報量を絞る）
  const highRules = rules.filter((r) => r.severity === "high");

  const system = `あなたは日本の金融・不動産系企業アカウントの SNS 投稿構成案を作成する専門エージェントです。
以下の制約とフォーマット定義に厳密に従って、Instagram カルーセル投稿の構成案を出力してください。

## 厳守事項（重要度 high の制作ルール）
${highRules.map((r) => `- [${r.id}] ${r.content}`).join("\n")}

## 表記ルール
- 文体は基本「ですます調」で統一（句読点使用）
- 用語説明・要約は体言止め可（句読点なし）
- 「セゾン」単体呼称は NG（「セゾンファンデックス」「セゾンのリースバック」は OK）
- NG 表記：×分かる→〇わかる、×掛かる→〇かかる、×業者→〇事業者、×不動産事業者→〇不動産会社
- 悲壮感・困窮感の強い表現は避ける

## 禁止表現（口語・造語・俗語）

金融機関の公式発信として不適切な表現を**使用しないこと**。以下は代表例：

- 口語・若者言葉：「〜じゃん」「〜だよね」「めっちゃ」「マジで」「ガチで」「ヤバい」
- 造語・俗語：「即アウト」「秒で〇〇」「詰む」「積む」「爆上がり」「神対応」
- 過度に煽る表現：「激ヤバ」「知らないと損」「今すぐ」を必要以上に繰り返す等
- 軽薄な断定：「〇〇一択」「結論だけ言うと」「ぶっちゃけ」
- カジュアル疑問：「〜って知ってる？」→「〜をご存じですか？」
- 感嘆符の多用：「！！！」「〜！？」等の連打

代替方針：
- 断定よりも「〇〇とされています」「〇〇の場合があります」等の婉曲を優先
- 警告は「注意点」「留意点」「リスク」といった中立語彙で表現
- 問いかけは「ご存じでしょうか」「〜をご検討ではありませんか」等の敬体


## スライド構造（3 層スキーマ）
各スライドは zone_top / zone_middle / zone_bottom の 3 ゾーンで構成されます。
各ゾーンに配置する要素（テキスト・図解・写真等）を明示してください。

## 出典（エビデンス）の扱い — 重要

制作ルール 3・4 に基づき、投稿内で数値・統計・制度・法令に触れる箇所には
**必ず出典を構造化して添える**こと。以下を厳守：

1. **許容ソース**：国・地方自治体（go.jp / lg.jp）、公益法人（or.jp）、
   大学（ac.jp）、信頼できる企業の公式サイト（企業の自社情報に限る）。
2. **NG ソース**：個人ブログ（note.com、ameblo、hatenablog、medium 等）、
   まとめサイト、SNS 投稿、出典不明記事。これらは引用しないこと。
3. **URL を必ず記載**：推測の URL は NG。本当に存在し、該当情報が載っている URL のみ。

### 粒度の要件（重要）

出典は **1 スライドに 1 つでは不十分** です。**事実主張 1 つにつき 1 citation** を
原則とし、以下を満たすこと：

- スライド内に複数の事実主張（数値 A、制度要件 B、法令条文 C 等）が含まれる場合は、
  **それぞれに対応する citation を分けて記載**すること。
- 同一ページから複数の情報を引く場合でも、**どの記述がどのセクションに対応するか**
  が追えるよう page_or_section を主張ごとに書き分ける。
- page_or_section は「制度概要」「適用要件」「第〇条」「表 3-1」「p.12 脚注 4」
  のように、**実際の見出し名・章番号・ページ番号・表番号**まで具体的に特定する
  （「〇〇のあたり」「冒頭」等の曖昧な指定は不可）。
- quote には**該当箇所の原文を 30〜80 字程度**で引用し、後から
  Ctrl+F で検索できる状態にする。
- title は記事タイトルではなく、**参照セクションの見出し**を優先して記載する。

### その他の運用

4. **数値・制度の記載がない**スライド（概念説明のみ、行動提案のみ等）は
   出典不要（sources を空配列 [] にする）。
5. **不明な場合**：URL を推測してはいけない。null を設定し、
   risk_notes に『要・手動で出典追加』と記載すること。
6. **同じ URL 内の異なる箇所**を複数参照する場合は、citation を複数エントリに分ける。
   1 citation に複数の page_or_section をまとめないこと。${
    useWebSearch
      ? `

## Web 検索ツールの利用（重要）

今回はあなたに **web_search ツール** が提供されています。数値・制度・法令・統計の
裏取りが必要な箇所は、**自分の記憶に頼らず、必ず web_search ツールで検索して一次ソースを
確認**してください。以下の手順を守ること：

1. ネタに関連する制度・数値・法令の**最新情報**を web_search で検索（例：
   『住宅ローン控除 2026 国税庁』『不動産取得税 軽減 国土交通省』）。
2. 検索結果で **公的ドメイン（go.jp / lg.jp / ac.jp / or.jp）** を優先的に
   クリックして内容確認。個人ブログ系は無視。
3. 取得した情報をもとに、該当スライドの \`sources\` 配列に URL ・タイトル・
   何ページ／どのセクションかを記載。
4. **検索で確認できなかった情報は使わない**か、\`sources\` を null にして
   risk_notes に『要手動確認』と記載。
5. 検索回数には上限があるため、**本当に出典が必要な箇所のみ**検索すること。
   概念説明や行動提案は検索不要。`
      : ""
  }

## 出力形式（厳密に従う）
以下の JSON のみを出力してください。前後に説明文を付けないでください。

\`\`\`json
{
  "titles": ["タイトル案1", "タイトル案2", "タイトル案3"],
  "slides": [
    {
      "index": 1,
      "role": "表紙",
      "template_id": "tpl_cover_pill_title",
      "zone_top": { "element": "category_pill", "content": "..." },
      "zone_middle": { "element": "main_title", "content": "..." },
      "zone_bottom": { "element": "logo", "content": "ロゴ" },
      "photo_hint": "物体＋手元：家の模型を指し示す手元",
      "diagram": null,
      "sources": [],
      "notes": "任意の補足"
    },
    {
      "index": 3,
      "role": "項目01",
      "template_id": "tpl_item_beforeafter",
      "zone_top": {"element": "heading", "content": "..."},
      "zone_middle": {"element": "diagram", "content": "..."},
      "zone_bottom": {"element": "highlight_box", "content": "住宅ローン控除は令和7年入居分まで延長され、控除率は年末残高の0.7%です。"},
      "photo_hint": null,
      "diagram": "compare_before_after",
      "sources": [
        {
          "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1213.htm",
          "title": "タックスアンサー No.1213 住宅借入金等特別控除・1 概要",
          "page_or_section": "1 概要",
          "quote": "居住者が住宅ローン等を利用して、マイホームの新築、取得又は増改築等をした場合で一定の要件を満たすときは、…控除を受けることができます。"
        },
        {
          "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1213.htm",
          "title": "タックスアンサー No.1213 住宅借入金等特別控除・3 控除期間及び控除額の計算方法",
          "page_or_section": "3 控除期間及び控除額の計算方法",
          "quote": "住宅ローン等の年末残高の合計額（住宅の取得等の対価の額が上限）に0.7%を乗じて計算した金額…"
        },
        {
          "url": "https://www.mlit.go.jp/jutakukentiku/house/jutakukentiku_house_tk4_000001.html",
          "title": "国土交通省 住宅ローン減税 令和6年度税制改正",
          "page_or_section": "子育て世帯・若者夫婦世帯の借入限度額の上乗せ",
          "quote": "子育て世帯・若者夫婦世帯については、令和6年入居の場合の借入限度額を維持…"
        }
      ],
      "notes": ""
    }
  ],
  "caption_outline": [
    "【保存版】〇〇",
    "リード文",
    "..."
  ],
  "risk_notes": [
    {"rule_id": "rule_09_institution_check", "note": "制度の最新性要確認"}
  ]
}
\`\`\`
`;

  const formatSpec = `## 選択されたフォーマット
- id: ${format.id}
- name: ${format.name}
- 一言: ${format.one_liner}
- 軸: フック=${format.axes.hook} / トーン=${format.axes.tone} / 構造=${format.axes.structure}
- 枚数: ${format.min_slides}〜${format.max_slides} 枚（本文のみ、CTA は最後に別途自動追加）
- エンプラ適合度: ${format.enterprise_caution}

### レシピ（本文の構成）
${format.recipe
  .map(
    (s, i) =>
      `${i + 1}. ${s.role}${s.optional ? "（任意）" : ""}${
        s.repeat ? `（×${s.repeat}）` : ""
      }\n   使えるテンプレ: ${s.template_options?.join(", ") || "なし"}${
        s.note ? `\n   補足: ${s.note}` : ""
      }`
  )
  .join("\n")}

### タイトル案テンプレ（3 案これに沿って作る）
${format.title_templates.map((t) => `- ${t}`).join("\n")}

### 使用可能なスライドテンプレ（抜粋）
${usedTemplates
  .map(
    (t) =>
      `- ${t.id}（${t.name}・${t.role}）
  top: ${JSON.stringify(t.zone_top)}
  middle: ${JSON.stringify(t.zone_middle)}
  bottom: ${JSON.stringify(t.zone_bottom)}`
  )
  .join("\n")}

### リスクフラグ
${
  format.risk_flags.length === 0
    ? "特になし"
    : format.risk_flags
        .map((r) => `- [${r.rule_id}] ${r.severity}: ${r.note || ""}`)
        .join("\n")
}
`;

  const user = `## ネタ
${topic}

${target ? `## ターゲット\n${target}\n` : ""}${goal ? `## ゴール\n${goal}\n` : ""}
${formatSpec}

以上を踏まえ、構成案を JSON で出力してください。最後に CTA スライドは含めなくて構いません（固定で自動追加します）。`;

  return { system, user };
}
