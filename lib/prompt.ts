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
4. **何ページ／どのセクション**か具体的に：PDF なら『p.12』、Web なら『〇〇章』『〇〇
   （見出し名）』のように特定できる形で記載。
5. **数値・制度の記載がない**スライド（概念説明のみ、行動提案のみ等）は
   出典不要（sources を空配列 [] にする）。
6. **不明な場合**：URL を推測してはいけない。null を設定し、
   risk_notes に『要・手動で出典追加』と記載すること。${
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
      "zone_bottom": {"element": "highlight_box", "content": "住宅ローン控除は 2026 年末まで延長されています。"},
      "photo_hint": null,
      "diagram": "compare_before_after",
      "sources": [
        {
          "url": "https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1213.htm",
          "title": "国税庁 No.1213 認定住宅の新築等をした場合（住宅借入金等特別控除）",
          "page_or_section": "制度概要・適用要件",
          "quote": "令和4年1月1日から令和7年12月31日までの間に居住の用に供した場合…"
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
