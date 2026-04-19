import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const DATA_DIR = path.join(process.cwd(), "data");

function load<T = any>(filename: string): T {
  const p = path.join(DATA_DIR, filename);
  const raw = fs.readFileSync(p, "utf-8");
  return yaml.load(raw) as T;
}

export type Format = {
  id: string;
  name: string;
  one_liner: string;
  axes: { hook: string; tone: string; structure: string };
  min_slides: number;
  max_slides: number;
  recipe: Array<{
    role: string;
    template_options: string[];
    repeat?: string | number;
    optional?: boolean;
    note?: string;
  }>;
  title_templates: string[];
  risk_flags: Array<{ rule_id: string; severity: string; note?: string }>;
  enterprise_caution: "ok" | "caution" | "avoid";
  example_topics?: string[];
  note?: string;
};

export type Template = {
  id: string;
  name: string;
  role: string;
  zone_top?: any;
  zone_middle?: any;
  zone_bottom?: any;
  seen_in_posts?: string[];
};

export type Diagram = {
  id: string;
  name: string;
  category: string;
  ascii_preview: string;
  use_case: string;
  text_slots: any;
  photo_hint?: string | null;
  seen_in_posts?: string[];
  source_requirement?: string;
};

export type Rule = {
  id: string;
  category: string;
  content: string;
  severity: "high" | "medium" | "low";
  detection: string;
  detection_pattern?: string;
};

export type CtaPattern = {
  id: string;
  name: string;
  action: string;
  copy_options: string[];
  placement: string;
  default?: boolean;
};

export type PagePattern = {
  id: string;
  name: string;
  role: string;
  template_ids: string[];
  based_on?: Array<{ post_id: string; page: string }>;
  summary: string;
  visual_cues?: string[];
};

let cache: {
  formats: Format[];
  templates: Template[];
  diagrams: Diagram[];
  rules: Rule[];
  cta_patterns: CtaPattern[];
  page_patterns: PagePattern[];
  elements: any;
  checklist: any;
} | null = null;

export function loadAll() {
  if (cache) return cache;
  cache = {
    formats: (load("formats.yaml") as any).formats,
    templates: (load("templates.yaml") as any).templates,
    diagrams: (load("diagram-gallery.yaml") as any).diagrams,
    rules: (load("writing-rules.yaml") as any).rules,
    cta_patterns: (load("cta-patterns.yaml") as any).cta_patterns,
    page_patterns: (load("page-patterns.yaml") as any).patterns,
    elements: load("elements.yaml"),
    checklist: (load("quality-checklist.yaml") as any).checklist,
  };
  return cache;
}

export const AXIS_OPTIONS = {
  hook: [
    { id: "question", name: "問いかけ", example: "〇〇できますか？" },
    { id: "number", name: "数字強調", example: "〇〇 5 選 / TOP 10" },
    { id: "promise", name: "約束・解決", example: "〇〇する方法" },
    { id: "mistake", name: "失敗警告", example: "やりがちな〇〇" },
    { id: "myth", name: "常識反転", example: "実は〇〇 / 〇〇は嘘" },
    { id: "story", name: "体験・告白", example: "私が〇〇した話" },
    { id: "category", name: "宣言・定義", example: "〇〇とは？" },
  ],
  tone: [
    { id: "positive", name: "ポジティブ", example: "ワクワク・お得" },
    { id: "neutral", name: "普通", example: "中立・情報整理" },
    { id: "negative", name: "ネガティブ", example: "恐れ・警告" },
  ],
  structure: [
    { id: "list", name: "リスト型" },
    { id: "step", name: "ステップ型" },
    { id: "compare", name: "比較型" },
    { id: "deepdive", name: "深掘り型" },
    { id: "story", name: "ストーリー型" },
    { id: "qa", name: "Q&A 型" },
    { id: "branch", name: "ケース分岐型" },
  ],
};
