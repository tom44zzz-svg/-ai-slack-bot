/**
 * スライドの SVG プレビューを生成。
 * 1080×1350 (Instagram カルーセル 4:5 縦) で、セゾンファンデックスのブランドカラー風。
 * 完璧な再現は目指さず、レイアウトの「形」が分かることを目的とする。
 */

const W = 1080;
const H = 1350;

const C = {
  bg: "#FDF8EE",          // ベージュ
  primary: "#174A9A",     // 青
  primaryLight: "#E5EDF8",
  accent: "#FFD93D",      // 黄
  accentLight: "#FFF4B8",
  text: "#1A1A1A",
  textMuted: "#666666",
  border: "#D9E2F1",
  white: "#FFFFFF",
  bulb: "#3B6FB8",
};

// シンプルな安全エスケープ
function esc(s: string): string {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// 文字列を maxChars ごとに改行して <tspan> を返す
function wrap(
  text: string,
  x: number,
  y: number,
  maxChars: number,
  lineHeight: number,
  attrs = ""
): string {
  const lines: string[] = [];
  let s = String(text || "");
  while (s.length > 0) {
    lines.push(s.slice(0, maxChars));
    s = s.slice(maxChars);
  }
  return lines
    .map(
      (l, i) =>
        `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}" ${attrs}>${esc(l)}</tspan>`
    )
    .join("");
}

// =============================================================================
// 共通装飾
// =============================================================================
function decorations(slideIndex: number, total: number, footer?: string): string {
  return `
    <!-- 左右の波線/ドット装飾 -->
    <g opacity="0.18" fill="${C.primary}">
      ${Array.from({ length: 8 })
        .map((_, i) => `<circle cx="30" cy="${200 + i * 100}" r="4"/>`)
        .join("")}
      ${Array.from({ length: 8 })
        .map((_, i) => `<circle cx="${W - 30}" cy="${250 + i * 100}" r="4"/>`)
        .join("")}
    </g>
    <!-- 三角アクセント -->
    <polygon points="0,0 80,0 0,80" fill="${C.primaryLight}"/>
    <polygon points="${W},${H} ${W - 80},${H} ${W},${H - 80}" fill="${C.primaryLight}"/>
    <!-- ページ番号バッジ（右上） -->
    <g>
      <rect x="${W - 160}" y="40" width="120" height="60" rx="30" fill="${C.primary}"/>
      <text x="${W - 100}" y="82" text-anchor="middle" font-size="32" font-weight="bold" fill="${C.white}" font-family="-apple-system, sans-serif">
        ${esc(String(slideIndex).padStart(2, "0"))}/${esc(String(total).padStart(2, "0"))}
      </text>
    </g>
    ${
      footer
        ? `<g>
            <rect x="0" y="${H - 90}" width="${W}" height="90" fill="${C.primary}"/>
            <text x="${W / 2}" y="${H - 35}" text-anchor="middle" font-size="32" font-weight="bold" fill="${C.white}" font-family="-apple-system, sans-serif">${esc(footer)}</text>
          </g>`
        : ""
    }
  `;
}

// 💡 枠囲みボックス（本文ハイライト）
function highlightBox(
  x: number,
  y: number,
  w: number,
  h: number,
  text: string
): string {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="20"
        fill="${C.primaryLight}" stroke="${C.primary}" stroke-width="3"/>
      <circle cx="${x + 50}" cy="${y + 50}" r="30" fill="${C.bulb}"/>
      <text x="${x + 50}" y="${y + 60}" text-anchor="middle" font-size="32" fill="${C.white}">💡</text>
      <text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle"
        font-size="36" fill="${C.text}" font-family="-apple-system, sans-serif">
        ${wrap(text, x + w / 2, y + h / 2, 18, 50)}
      </text>
    </g>
  `;
}

// =============================================================================
// テンプレ別のレンダリング
// =============================================================================

function renderCover(slide: any): string {
  const top = slide.zone_top?.content || "";
  const middle = slide.zone_middle?.content || "";
  return `
    <!-- 背景写真エリア（プレースホルダ） -->
    <rect x="0" y="0" width="${W}" height="${H}" fill="${C.bg}"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="${C.primary}" opacity="0.05"/>

    <!-- カテゴリピル -->
    <g>
      <rect x="${W / 2 - 250}" y="180" width="500" height="80" rx="40" fill="${C.primary}"/>
      <text x="${W / 2}" y="232" text-anchor="middle" font-size="36" font-weight="bold" fill="${C.white}" font-family="-apple-system, sans-serif">
        ${esc(top || "カテゴリ")}
      </text>
    </g>

    <!-- メインタイトル -->
    <g>
      <rect x="80" y="380" width="${W - 160}" height="600" rx="20"
        fill="${C.white}" opacity="0.92" stroke="${C.border}" stroke-width="2"/>
      <text x="${W / 2}" y="500" text-anchor="middle"
        font-size="68" font-weight="bold" fill="${C.text}" font-family="-apple-system, sans-serif">
        ${wrap(middle, W / 2, 500, 11, 90)}
      </text>
    </g>

    <!-- ロゴ位置 -->
    <g>
      <rect x="${W / 2 - 200}" y="${H - 200}" width="400" height="100" rx="50"
        fill="${C.white}" stroke="${C.primary}" stroke-width="2"/>
      <text x="${W / 2}" y="${H - 137}" text-anchor="middle"
        font-size="36" font-weight="bold" fill="${C.primary}" font-family="-apple-system, sans-serif">
        セゾンファンデックス
      </text>
    </g>
  `;
}

function renderHeader(text: string, y: number): string {
  return `
    <g>
      <rect x="80" y="${y}" width="${W - 160}" height="120" rx="16" fill="${C.primary}"/>
      <text x="${W / 2}" y="${y + 80}" text-anchor="middle"
        font-size="44" font-weight="bold" fill="${C.white}" font-family="-apple-system, sans-serif">
        ${wrap(text, W / 2, y + 80, 22, 56)}
      </text>
    </g>
  `;
}

// 図解：BeforeAfter
function diagBeforeAfter(): string {
  const cy = 800;
  return `
    <g>
      <rect x="180" y="${cy - 130}" width="280" height="260" rx="16" fill="${C.white}" stroke="${C.border}" stroke-width="3"/>
      <text x="320" y="${cy - 30}" text-anchor="middle" font-size="40" fill="${C.textMuted}" font-family="-apple-system, sans-serif">Before</text>
      <text x="320" y="${cy + 50}" text-anchor="middle" font-size="60">🏠</text>

      <text x="${W / 2}" y="${cy + 15}" text-anchor="middle" font-size="80" fill="${C.primary}">→</text>

      <rect x="620" y="${cy - 130}" width="280" height="260" rx="16" fill="${C.primaryLight}" stroke="${C.primary}" stroke-width="3"/>
      <text x="760" y="${cy - 30}" text-anchor="middle" font-size="40" fill="${C.primary}" font-weight="bold" font-family="-apple-system, sans-serif">After</text>
      <text x="760" y="${cy + 50}" text-anchor="middle" font-size="60">🏡</text>
    </g>
  `;
}

// 図解：3 列カード
function diag3Column(): string {
  const cy = 800;
  const cards = ["A", "B", "C"];
  return `
    <g>
      ${cards
        .map(
          (lbl, i) => `
        <rect x="${100 + i * 300}" y="${cy - 150}" width="260" height="300" rx="16"
          fill="${C.white}" stroke="${C.primary}" stroke-width="3"/>
        <text x="${230 + i * 300}" y="${cy - 70}" text-anchor="middle"
          font-size="48" font-weight="bold" fill="${C.primary}" font-family="-apple-system, sans-serif">${lbl}</text>
        <text x="${230 + i * 300}" y="${cy + 30}" text-anchor="middle"
          font-size="36" fill="${C.textMuted}">─────</text>
        <text x="${230 + i * 300}" y="${cy + 100}" text-anchor="middle"
          font-size="32" fill="${C.text}" font-family="-apple-system, sans-serif">特徴</text>
      `
        )
        .join("")}
    </g>
  `;
}

// 図解：3 アイコン並列
function diagIconsRow3(): string {
  const cy = 800;
  const icons = ["📈", "💰", "📊"];
  return `
    <g>
      ${icons
        .map(
          (ic, i) => `
        <circle cx="${230 + i * 290}" cy="${cy}" r="100" fill="${C.primaryLight}" stroke="${C.primary}" stroke-width="3"/>
        <text x="${230 + i * 290}" y="${cy + 30}" text-anchor="middle" font-size="80">${ic}</text>
      `
        )
        .join("")}
    </g>
  `;
}

// 図解：2x2 カード
function diagCards2x2(): string {
  const cy = 750;
  return `
    <g>
      ${[
        [120, cy - 140, "1"],
        [560, cy - 140, "2"],
        [120, cy + 60, "3"],
        [560, cy + 60, "4"],
      ]
        .map(
          ([x, y, lbl]) => `
        <rect x="${x}" y="${y}" width="400" height="180" rx="16"
          fill="${C.white}" stroke="${C.primary}" stroke-width="3"/>
        <text x="${(x as number) + 200}" y="${(y as number) + 110}" text-anchor="middle"
          font-size="48" font-weight="bold" fill="${C.primary}" font-family="-apple-system, sans-serif">${lbl}</text>
      `
        )
        .join("")}
    </g>
  `;
}

// 図解：比較表
function diagTableRow(): string {
  const cy = 800;
  return `
    <g stroke="${C.border}" stroke-width="2">
      ${["A", "B", "C", "D"]
        .map(
          (_, r) => `
        <rect x="120" y="${cy - 200 + r * 100}" width="${W - 240}" height="100"
          fill="${r % 2 === 0 ? C.white : C.primaryLight}"/>
        ${[0, 1, 2, 3]
          .map(
            (col) => `
          <text x="${250 + col * 200}" y="${cy - 140 + r * 100}" text-anchor="middle"
            font-size="32" fill="${C.text}" font-family="-apple-system, sans-serif">●</text>
        `
          )
          .join("")}
      `
        )
        .join("")}
    </g>
  `;
}

// 図解：警告ボックス
function diagWarning(): string {
  return `
    <g>
      <rect x="120" y="700" width="${W - 240}" height="200" rx="20"
        fill="#FFF4E6" stroke="#F59E0B" stroke-width="4"/>
      <text x="180" y="820" font-size="80">⚠</text>
      <text x="290" y="820" font-size="44" fill="#92400E" font-weight="bold" font-family="-apple-system, sans-serif">注意ポイント</text>
    </g>
  `;
}

// 図解：チェックリスト
function diagChecklist(): string {
  return `
    <g>
      ${[0, 1, 2, 3]
        .map(
          (i) => `
        <rect x="120" y="${600 + i * 100}" width="${W - 240}" height="80" rx="12"
          fill="${C.white}" stroke="${C.border}" stroke-width="2"/>
        <text x="170" y="${655 + i * 100}" font-size="48" fill="${C.primary}">☑</text>
        <text x="240" y="${655 + i * 100}" font-size="36" fill="${C.text}" font-family="-apple-system, sans-serif">項目 ${i + 1}</text>
      `
        )
        .join("")}
    </g>
  `;
}

// 図解：大数字
function diagNumberBig(): string {
  return `
    <g>
      <circle cx="${W / 2}" cy="800" r="200" fill="${C.accent}" opacity="0.3"/>
      <text x="${W / 2}" y="850" text-anchor="middle"
        font-size="200" font-weight="bold" fill="${C.primary}" font-family="-apple-system, sans-serif">N%</text>
    </g>
  `;
}

// 図解：引用吹き出し
function diagQuote(): string {
  return `
    <g>
      <rect x="120" y="650" width="${W - 240}" height="280" rx="20"
        fill="${C.white}" stroke="${C.primary}" stroke-width="3"/>
      <text x="${W / 2}" y="780" text-anchor="middle"
        font-size="44" fill="${C.text}" font-family="-apple-system, sans-serif">「〇〇のに…」</text>
      <text x="${W / 2}" y="850" text-anchor="middle"
        font-size="44" fill="${C.text}" font-family="-apple-system, sans-serif">「〇〇なのに…」</text>
    </g>
  `;
}

// 図解：フロー
function diagFlow(): string {
  const cy = 800;
  return `
    <g>
      ${[0, 1, 2, 3].map((i) => `
        <rect x="${100 + i * 220}" y="${cy - 80}" width="180" height="160" rx="16"
          fill="${C.white}" stroke="${C.primary}" stroke-width="3"/>
        <text x="${190 + i * 220}" y="${cy + 15}" text-anchor="middle"
          font-size="56" font-weight="bold" fill="${C.primary}" font-family="-apple-system, sans-serif">${i + 1}</text>
        ${i < 3 ? `<text x="${290 + i * 220}" y="${cy + 15}" text-anchor="middle" font-size="40" fill="${C.primary}">→</text>` : ""}
      `).join("")}
    </g>
  `;
}

const DIAGRAM_RENDERERS: Record<string, () => string> = {
  compare_before_after: diagBeforeAfter,
  compare_vs_2col: diag3Column,
  compare_pros_cons: diagBeforeAfter,
  compare_do_dont: diagBeforeAfter,
  compare_table_row: diagTableRow,
  compare_3_column: diag3Column,
  icons_row_3: diagIconsRow3,
  cards_2x2: diagCards2x2,
  flow_arrow_steps: diagFlow,
  flow_cycle: diagFlow,
  recommend_by_case: diagChecklist,
  ranking_top_n: diagChecklist,
  number_highlight: diagNumberBig,
  quote_callout: diagQuote,
  checkmark_list: diagChecklist,
  warning_callout: diagWarning,
  graph_bar: diagFlow,
  graph_line: diagFlow,
  tree_relation: diag3Column,
  persona_pass_fail: diagIconsRow3,
};

function renderContent(slide: any): string {
  const heading = slide.zone_top?.content || "";
  const middle = slide.zone_middle?.content || "";
  const bottom = slide.zone_bottom?.content || "";
  const diagramFn = slide.diagram ? DIAGRAM_RENDERERS[slide.diagram] : undefined;

  return `
    ${renderHeader(heading, 160)}
    ${diagramFn ? diagramFn() : `
      <rect x="120" y="370" width="${W - 240}" height="500" rx="20"
        fill="${C.white}" stroke="${C.border}" stroke-width="3" stroke-dasharray="10,8"/>
      <text x="${W / 2}" y="620" text-anchor="middle" font-size="40" fill="${C.textMuted}" font-family="-apple-system, sans-serif">
        ${wrap(middle || "（中央エリア）", W / 2, 620, 24, 60)}
      </text>
    `}
    ${bottom ? highlightBox(120, 1000, W - 240, 220, bottom) : ""}
  `;
}

function renderCta(slide: any): string {
  const heading = slide.zone_top?.content || "お役立ち情報を発信中！";
  const bottom = slide.zone_bottom?.content || "保存して見返そう";
  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="${C.primary}"/>

    <!-- ロゴカード -->
    <g>
      <rect x="${W / 2 - 250}" y="160" width="500" height="120" rx="20" fill="${C.white}"/>
      <text x="${W / 2}" y="240" text-anchor="middle"
        font-size="44" font-weight="bold" fill="${C.primary}" font-family="-apple-system, sans-serif">
        セゾンファンデックス
      </text>
    </g>

    <!-- メインコピー -->
    <text x="${W / 2}" y="420" text-anchor="middle"
      font-size="56" font-weight="bold" fill="${C.white}" font-family="-apple-system, sans-serif">
      ${wrap(heading, W / 2, 420, 16, 80)}
    </text>

    <!-- スマホモックアップ風 -->
    <g>
      <rect x="200" y="600" width="320" height="540" rx="40" fill="${C.white}"/>
      <rect x="220" y="640" width="280" height="460" rx="8" fill="${C.bg}"/>
      <circle cx="360" cy="700" r="35" fill="${C.primary}"/>
    </g>

    <!-- フォローボタン -->
    <g>
      <rect x="580" y="800" width="380" height="160" rx="20" fill="${C.accent}"/>
      <text x="770" y="870" text-anchor="middle"
        font-size="36" font-weight="bold" fill="${C.text}" font-family="-apple-system, sans-serif">
        フォローして
      </text>
      <text x="770" y="920" text-anchor="middle"
        font-size="36" font-weight="bold" fill="${C.text}" font-family="-apple-system, sans-serif">
        最新情報を GET！
      </text>
    </g>

    <!-- 保存促し -->
    <text x="${W / 2}" y="${H - 60}" text-anchor="middle"
      font-size="40" font-weight="bold" fill="${C.white}" font-family="-apple-system, sans-serif">
      🔖 ${esc(bottom)}
    </text>
  `;
}

// =============================================================================
// メイン
// =============================================================================
export function renderSlideSvg(slide: any, total = 10): string {
  const role = slide.role || "";
  const tplId = slide.template_id || "";
  const isCover = role === "表紙" || tplId.startsWith("tpl_cover");
  const isCta = role === "CTA" || tplId.includes("cta");

  let body: string;
  if (isCover) {
    body = renderCover(slide);
  } else if (isCta) {
    body = renderCta(slide);
  } else {
    body = renderContent(slide);
  }

  const footer = !isCta && slide.zone_bottom?.element === "footer_next" ? slide.zone_bottom?.content : null;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    ${decorations(slide.index || 1, total, footer)}
    ${body}
  </svg>`;
}
