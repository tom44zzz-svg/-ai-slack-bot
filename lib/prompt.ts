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
}): { system: string; user: string } {
  const { topic, target, goal, format, templates, rules } = args;

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
      "notes": "任意の補足"
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
