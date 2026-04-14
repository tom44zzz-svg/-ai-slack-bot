/**
 * 図解タイプ → Canva テンプレ検索クエリのマッピング。
 * 各スライドから Canva で近いテンプレートを探す検索 URL を生成する。
 */

const DIAGRAM_TO_CANVA_QUERY: Record<string, string> = {
  compare_before_after: "instagram post before after comparison",
  compare_vs_2col: "instagram post vs comparison 2 columns",
  compare_pros_cons: "instagram post pros cons",
  compare_do_dont: "instagram post do dont checklist",
  compare_table_row: "instagram post comparison table",
  compare_3_column: "instagram post 3 column comparison",
  icons_row_3: "instagram post 3 icons row",
  cards_2x2: "instagram post 2x2 grid cards",
  tree_relation: "instagram post family tree diagram",
  persona_pass_fail: "instagram post persona flow diagram",
  flow_arrow_steps: "instagram post step by step arrows",
  flow_cycle: "instagram post cycle diagram",
  recommend_by_case: "instagram post recommendation by case",
  ranking_top_n: "instagram post ranking top",
  graph_bar: "instagram post bar chart infographic",
  graph_line: "instagram post line chart infographic",
  number_highlight: "instagram post big number statistic",
  quote_callout: "instagram post quote callout",
  checkmark_list: "instagram post checklist",
  warning_callout: "instagram post warning callout",
};

const ROLE_TO_CANVA_QUERY: Record<string, string> = {
  表紙: "instagram post cover carousel first slide",
  問題提起: "instagram post problem intro quote",
  "問題提起 / 導入": "instagram post intro comparison",
  項目: "instagram post content slide numbered",
  "項目 / 手順": "instagram post step slide",
  "項目 / まとめ": "instagram post checklist summary",
  まとめ: "instagram post summary key points",
  CTA: "instagram post follow cta last slide",
};

export function getCanvaSearchUrl(opts: {
  diagram?: string | null;
  role?: string;
}): string {
  const base = "https://www.canva.com/ja_jp/search/templates?q=";
  let query: string | undefined;
  if (opts.diagram && DIAGRAM_TO_CANVA_QUERY[opts.diagram]) {
    query = DIAGRAM_TO_CANVA_QUERY[opts.diagram];
  } else if (opts.role && ROLE_TO_CANVA_QUERY[opts.role]) {
    query = ROLE_TO_CANVA_QUERY[opts.role];
  } else {
    query = "instagram post carousel japanese finance";
  }
  return base + encodeURIComponent(query);
}
