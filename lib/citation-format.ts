/**
 * Canva のコメント欄に貼り付けるための出典テキスト整形。
 * 担当者がコピー＆ペーストするだけで、社内ルール通りの参照元情報が
 * Canva のコメントとして残せるようにする。
 */

type Citation = {
  url: string;
  title?: string;
  page_or_section?: string;
  quote?: string;
};

type Slide = {
  index: number;
  role: string;
  sources?: Array<Citation & { verdict?: { classification?: string } }>;
};

/**
 * 1 スライド分の出典を Canva コメント用テキストに整形。
 * 出典なしの場合は空文字。
 */
export function formatSlideCitations(slide: Slide): string {
  const cites = slide.sources || [];
  if (cites.length === 0) return "";
  const header = `【参照元】Slide ${slide.index} ${slide.role}`;
  const body = cites.map((c, i) => formatOne(c, i + 1)).join("\n\n");
  return `${header}\n${body}`;
}

/**
 * 全スライドの出典を 1 つのブロックに整形。
 * 投稿全体のキャプション or Canva 全体コメントに貼る用。
 */
export function formatAllCitations(slides: Slide[]): string {
  const blocks = slides
    .filter((s) => (s.sources || []).length > 0)
    .map((s) => formatSlideCitations(s));
  if (blocks.length === 0) return "";
  return ["【参照元一覧】", ...blocks].join("\n\n────────\n\n");
}

function formatOne(c: Citation, n: number): string {
  const lines: string[] = [];
  lines.push(`${n}. ${c.title || "（タイトル未取得）"}`);
  if (c.page_or_section) lines.push(`   セクション: ${c.page_or_section}`);
  lines.push(`   URL: ${c.url}`);
  if (c.quote) lines.push(`   引用: 「${c.quote}」`);
  return lines.join("\n");
}
