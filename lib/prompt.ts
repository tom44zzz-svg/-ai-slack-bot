import { Format, Template, Rule } from "./data-loader";

/**
 * LLM に渡すシステムプロンプトと、ユーザーメッセージを組み立てる。
 * トークン数を抑えるため、コンパクトな表現・ID 参照主体で組み立てる。
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

  const usedTemplateIds = new Set<string>();
  for (const step of format.recipe) {
    step.template_options?.forEach((id) => usedTemplateIds.add(id));
  }
  const usedTemplates = templates.filter((t) => usedTemplateIds.has(t.id));

  const system = `あなたはセゾンファンデックス（金融・不動産）の Instagram カルーセル投稿の構成案を JSON で出力する専門エージェントです。

## 文体・表記
- ですます調（句読点あり）。用語説明・要約は体言止め可（句読点なし）。
- 「セゾン」単体呼称 NG（「セゾンファンデックス」「セゾンのリースバック」は OK）。
- 誤→正：分かる→わかる / 掛かる→かかる / 業者→事業者 / 不動産事業者→不動産会社。
- 悲壮感・困窮感の強い表現は避ける。
- 口語・造語・俗語 禁止：〜じゃん、めっちゃ、マジで、ガチで、ヤバい、即アウト、詰む、爆上がり、神対応、〜一択、ぶっちゃけ、！！！等。代替：〜とされています / 留意点 / ご存じでしょうか 等の敬体。

## スライド構造
各スライドは zone_top / zone_middle / zone_bottom の 3 ゾーン。各ゾーンに要素 id と content を入れる。

## ソース優先（厳守）
1. 最優先：fundex.co.jp/contents/ 自社コラム（classification=preferred）
2. 次点：国・公益（go.jp / lg.jp / or.jp / ac.jp）
3. 登録企業：nta.go.jp / mof.go.jp / mlit.go.jp / fsa.go.jp 等
4. NG：個人ブログ（note / ameblo / hatena / medium / qiita / zenn 等）、まとめサイト、SNS

## 出典（sources[]）
- 数値・制度・法令・統計を含むスライドには必ず sources[] を添える（概念説明や行動提案は不要、[] で可）。
- **主張 1 つにつき 1 citation**。スライド内に複数主張があれば複数エントリに分割。
- 各 citation：{url, title, page_or_section, quote}
  - page_or_section は実際の見出し・章・表・ページ（例「1 概要」「表 3-1」「p.12 脚注」）。曖昧語（「冒頭」「あたり」）不可。
  - quote は原文 30〜80 字。
  - title は参照セクションの見出しを優先。
- URL 推測禁止。不明時は sources=null として risk_notes に「要手動確認」と記載。${
    useWebSearch
      ? `

## web_search 利用手順
1. **最初に** \`site:fundex.co.jp/contents キーワード\` で検索。該当コラムがあれば第一ソース採用。
2. コラムで扱っていない最新制度・統計は公的機関（go.jp 等）で補完。
3. 検索は**本当に出典が必要な主張のみ**（概念説明は検索不要）。
4. コラム不在時は risk_notes に「Fundex コラムのカバレッジなし」と記載。`
      : ""
  }

## タイトル 3 案
**同じ主旨を** 3 つの切り口で言い換える。別のネタに見える案は NG。
切り口：ベネフィット訴求 / 問いかけ / 中立解説 / 注意喚起（穏やか） / 数字・具体性訴求 — から 3 つ選ぶ。
各案 20〜28 字。過度な煽り（絶対・今すぐ・損する連呼）禁止。

## 出力形式（JSON のみ。前後に説明文を付けない）

\`\`\`json
{
  "titles": [
    {"approach": "ベネフィット訴求", "text": "..."},
    {"approach": "中立解説", "text": "..."},
    {"approach": "注意喚起", "text": "..."}
  ],
  "slides": [
    {
      "index": 1,
      "role": "表紙",
      "template_id": "tpl_cover_pill_title",
      "zone_top": {"element": "category_pill", "content": "..."},
      "zone_middle": {"element": "main_title", "content": "..."},
      "zone_bottom": {"element": "logo", "content": "ロゴ"},
      "photo_hint": "物体＋手元：家の模型",
      "diagram": null,
      "sources": []
    },
    {
      "index": 3,
      "role": "項目01",
      "template_id": "tpl_item_beforeafter",
      "zone_top": {"element": "heading", "content": "..."},
      "zone_middle": {"element": "diagram", "content": "..."},
      "zone_bottom": {"element": "highlight_box", "content": "..."},
      "photo_hint": null,
      "diagram": "compare_before_after",
      "sources": [
        {"url":"https://www.nta.go.jp/...","title":"...・1 概要","page_or_section":"1 概要","quote":"..."}
      ]
    }
  ],
  "caption_outline": ["【保存版】...", "リード", "..."],
  "risk_notes": [{"rule_id":"rule_09_institution_check","note":"制度の最新性要確認"}]
}
\`\`\`

CTA スライド（最終）は自動で追加されるので含めないこと。`;

  // formatSpec は最小化：テンプレは id + role のみ
  const formatSpec = `## 選択されたフォーマット
- id: ${format.id} / name: ${format.name}
- 軸: ${format.axes.hook} × ${format.axes.tone} × ${format.axes.structure}
- 本文枚数: ${format.min_slides}〜${format.max_slides}

### レシピ（本文構成）
${format.recipe
  .map(
    (s, i) =>
      `${i + 1}. ${s.role}${s.optional ? "(任意)" : ""}${s.repeat ? `×${s.repeat}` : ""} → ${s.template_options?.join("/") || ""}`
  )
  .join("\n")}

### 使えるテンプレ一覧
${usedTemplates.map((t) => `- ${t.id} (${t.role})`).join("\n")}

### タイトル雛形（参考）
${format.title_templates.map((t) => `- ${t}`).join("\n")}${
    format.risk_flags.length > 0
      ? `

### リスク
${format.risk_flags.map((r) => `- [${r.rule_id}] ${r.severity}`).join("\n")}`
      : ""
  }`;

  const user = `## ネタ
${topic}
${target ? `\n## ターゲット\n${target}` : ""}${goal ? `\n## ゴール\n${goal}` : ""}

${formatSpec}`;

  return { system, user };
}
