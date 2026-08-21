#!/usr/bin/env node
/**
 * 半自動営業 CLI
 *
 *   node scripts/sales.mjs platforms
 *   node scripts/sales.mjs add --platform kaikoku --company "株式会社X" --title "SNS運用" --type sns
 *   node scripts/sales.mjs draft 11
 *   node scripts/sales.mjs set 11 replied --note "面談打診あり"
 *   node scripts/sales.mjs report [--weeks 8]
 *   node scripts/sales.mjs stale
 *
 * 応募文の生成に Claude を使う場合のみ ANTHROPIC_API_KEY が必要です。
 * それ以外のコマンドはローカルのCSV/JSONだけで動きます。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SALES = path.join(ROOT, "sales");
const LOG_PATH = path.join(SALES, "log", "applications.csv");
const DRAFTS_DIR = path.join(SALES, "drafts");

const COLUMNS = [
  "id", "applied_at", "platform", "job_type", "company", "title", "url",
  "rate", "status", "replied_at", "meeting_at", "closed_at", "note",
];

/** 応募 → 返信 → 面談 → 決着。set コマンドが受け付ける値。 */
const STATUSES = ["applied", "replied", "meeting", "won", "lost", "ghosted"];

/** status を進めたとき、自動で今日の日付を入れる列。 */
const STATUS_DATE_COLUMN = {
  applied: "applied_at",
  replied: "replied_at",
  meeting: "meeting_at",
  won: "closed_at",
  lost: "closed_at",
  ghosted: "closed_at",
};

const JOB_TYPES = {
  sns: "SNS運用・アカウント運用",
  "short-video": "ショート動画・動画編集",
  ad: "広告運用",
  photo: "撮影・フォトグラファー",
};

// ---------------------------------------------------------------- CSV

/** RFC4180 相当の最小パーサ。引用符内のカンマ・改行・""（エスケープ）を扱う。 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function readLog() {
  if (!fs.existsSync(LOG_PATH)) return [];
  const rows = parseCsv(fs.readFileSync(LOG_PATH, "utf8"));
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

function writeLog(records) {
  const lines = [COLUMNS.join(",")];
  for (const rec of records) {
    lines.push(COLUMNS.map((c) => csvEscape(rec[c])).join(","));
  }
  fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  fs.writeFileSync(LOG_PATH, lines.join("\n") + "\n", "utf8");
}

// ---------------------------------------------------------------- dates

const today = () => new Date().toISOString().slice(0, 10);

function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.parse(`${today()}T00:00:00Z`) - then) / 86_400_000);
}

/** その日を含む週の月曜日（YYYY-MM-DD）。週次集計のバケットキー。 */
function weekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const shift = (d.getUTCDay() + 6) % 7; // 月曜=0
  d.setUTCDate(d.getUTCDate() - shift);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------- output

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/** 全角を2幅として数えた表示幅。日本語を含む表を揃えるのに使う。 */
function width(s) {
  let w = 0;
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    w += (c >= 0x1100 && (c <= 0x115f || c === 0x2329 || c === 0x232a ||
      (c >= 0x2e80 && c <= 0xa4cf && c !== 0x303f) ||
      (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6))) ? 2 : 1;
  }
  return w;
}

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - width(s)));

/** 表示幅 max を超えたら … で打ち切る。全角を2幅として数える。 */
function truncate(s, max) {
  const str = String(s ?? "");
  if (width(str) <= max) return str;
  let out = "";
  for (const ch of str) {
    if (width(out) + width(ch) > max - 1) break;
    out += ch;
  }
  return out + "…";
}

function table(headers, rows) {
  const widths = headers.map((h, i) =>
    Math.max(width(h), ...rows.map((r) => width(r[i] ?? ""))));
  const line = (cells, dim = false) =>
    (dim ? DIM : "") + cells.map((c, i) => pad(c ?? "", widths[i])).join("  ").trimEnd() + (dim ? RESET : "");
  console.log(line(headers, true));
  console.log(DIM + widths.map((w) => "─".repeat(w)).join("  ") + RESET);
  for (const r of rows) console.log(line(r));
}

const pct = (n, d) => (d === 0 ? "—" : `${Math.round((n / d) * 100)}%`);

function die(msg) {
  console.error(`エラー: ${msg}`);
  process.exit(1);
}

// ---------------------------------------------------------------- args

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[a.slice(2)] = argv[++i];
      else flags[a.slice(2)] = true;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

const loadJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

// ---------------------------------------------------------------- commands

function cmdPlatforms() {
  const { platforms } = loadJson(path.join(SALES, "platforms.json"));
  const label = {
    active: "稼働中", registered: "登録済み", not_registered: "未登録",
  };
  const auto = {
    "monitor-only": "新着監視のみ自動", manual: "手動", none: "自動化不可",
  };
  const sorted = [...platforms].sort((a, b) => a.priority - b.priority);
  table(
    ["優先", "ID", "媒体", "状態", "自動化方針", "職種"],
    sorted.map((p) => [
      String(p.priority), p.id, p.name,
      label[p.status] ?? p.status, auto[p.automation] ?? p.automation,
      p.job_types.join("/"),
    ]),
  );
  const todo = sorted.filter((p) => p.status === "not_registered" && p.priority === 1);
  if (todo.length) {
    console.log(`\n${BOLD}未登録の最優先媒体:${RESET} ${todo.map((p) => `${p.name} (${p.url})`).join("  ")}`);
  }
}

function cmdAdd(flags) {
  const { platforms } = loadJson(path.join(SALES, "platforms.json"));
  const required = ["platform", "company"];
  for (const k of required) if (!flags[k]) die(`--${k} は必須です`);

  if (!platforms.some((p) => p.id === flags.platform)) {
    die(`platform '${flags.platform}' は platforms.json にありません。使える値: ${platforms.map((p) => p.id).join(", ")}`);
  }
  const jobType = flags.type ?? flags["job-type"] ?? "";
  if (jobType && !JOB_TYPES[jobType]) {
    die(`--type は ${Object.keys(JOB_TYPES).join(" / ")} のいずれかです`);
  }

  const records = readLog();
  const id = String(Math.max(0, ...records.map((r) => Number(r.id) || 0)) + 1);
  const rec = {
    id,
    applied_at: flags.date ?? today(),
    platform: flags.platform,
    job_type: jobType,
    company: flags.company,
    title: flags.title ?? "",
    url: flags.url ?? "",
    rate: flags.rate ?? "",
    status: "applied",
    replied_at: "", meeting_at: "", closed_at: "",
    note: flags.note ?? "",
  };
  records.push(rec);
  writeLog(records);
  console.log(`#${id} ${rec.company} を応募として記録しました（${rec.applied_at} / ${rec.platform}）`);
  if (jobType) console.log(`応募文のドラフト: node scripts/sales.mjs draft ${id}`);
}

function cmdSet(positional, flags) {
  const [id, status] = positional;
  if (!id) die("ID を指定してください");
  if (status && !STATUSES.includes(status)) {
    die(`status は ${STATUSES.join(" / ")} のいずれかです`);
  }

  const records = readLog();
  const rec = records.find((r) => r.id === String(id));
  if (!rec) die(`#${id} が見つかりません`);

  if (status) {
    rec.status = status;
    const col = STATUS_DATE_COLUMN[status];
    if (col && !rec[col]) rec[col] = flags.date ?? today();
  }
  if (flags.note) rec.note = rec.note ? `${rec.note} / ${flags.note}` : flags.note;
  for (const col of ["applied_at", "replied_at", "meeting_at", "closed_at",
                     "rate", "url", "title", "platform", "job_type"]) {
    if (typeof flags[col] === "string") rec[col] = flags[col];
  }

  writeLog(records);
  console.log(`#${rec.id} ${rec.company} → ${rec.status}${rec.note ? `（${rec.note}）` : ""}`);
}

function cmdList(flags) {
  let records = readLog();
  if (flags.status) records = records.filter((r) => r.status === flags.status);
  if (flags.platform) records = records.filter((r) => r.platform === flags.platform);
  if (!records.length) return console.log("該当する記録がありません。");

  table(
    ["ID", "応募日", "媒体", "企業", "職種", "状態", "最終更新からの日数"],
    records.map((r) => {
      const last = r.closed_at || r.meeting_at || r.replied_at || r.applied_at;
      const d = daysSince(last);
      return [
        r.id, r.applied_at || "—", r.platform || "—", r.company,
        r.job_type || "—", r.status, d == null ? "—" : `${d}日`,
      ];
    }),
  );
}

/**
 * 追客漏れの検出。複業クラウドで面談まで行った4件が
 * 2〜3週間放置されていたのが、この機能を入れた理由。
 */
function cmdStale(flags) {
  const limits = {
    applied: Number(flags["applied-days"] ?? 7),
    replied: Number(flags["replied-days"] ?? 5),
    meeting: Number(flags["meeting-days"] ?? 7),
  };
  const rows = [];
  for (const r of readLog()) {
    const limit = limits[r.status];
    if (limit == null) continue;
    const last = r.meeting_at || r.replied_at || r.applied_at;
    const d = daysSince(last);
    if (d != null && d >= limit) {
      rows.push([r.id, r.company, r.status, `${d}日`, `${limit}日`, truncate(r.note, 44)]);
    }
  }
  if (!rows.length) return console.log("追客待ちの案件はありません。");

  rows.sort((a, b) => parseInt(b[3]) - parseInt(a[3]));
  console.log(`${BOLD}追客が必要な案件 ${rows.length}件${RESET}\n`);
  table(["ID", "企業", "状態", "経過", "しきい値", "メモ"], rows);
}

function cmdReport(flags) {
  const records = readLog();
  if (!records.length) return console.log("応募ログが空です。");

  const weeks = Number(flags.weeks ?? 6);
  // 決着済み(won/lost/ghosted)は途中段階を通過したか日付でしか判定できないため、
  // ステータスの順位と記録済みの日付の両方を見る。
  const RANK = { applied: 0, replied: 1, meeting: 2, won: 3, lost: 3, ghosted: 3 };
  const reached = (r, stage) => {
    const rank = RANK[r.status] ?? 0;
    // ghosted は「応募したが音沙汰なし」なので、返信日が無い限り返信済みには数えない。
    if (stage === "replied") {
      return rank === 1 || rank === 2 || r.status === "won" || r.status === "lost" || !!r.replied_at;
    }
    if (stage === "meeting") return rank === 2 || !!r.meeting_at;
    return true;
  };

  const total = records.length;
  const replied = records.filter((r) => reached(r, "replied")).length;
  const meeting = records.filter((r) => reached(r, "meeting")).length;
  const won = records.filter((r) => r.status === "won").length;
  const lost = records.filter((r) => r.status === "lost").length;
  const open = records.filter((r) => ["applied", "replied", "meeting"].includes(r.status)).length;
  const noDate = records.filter((r) => !r.applied_at).length;

  console.log(`${BOLD}ファネル全体${RESET}`);
  table(
    ["応募", "返信", "返信率", "面談", "面談化率", "成約", "成約率", "見送り", "進行中"],
    [[
      String(total), String(replied), pct(replied, total),
      String(meeting), pct(meeting, replied), String(won), pct(won, total),
      String(lost), String(open),
    ]],
  );

  if (noDate) {
    console.log(`\n${DIM}※ 応募日が未記録の行が ${noDate}件あります（週次集計から除外）。${RESET}`);
  }

  // ---- 週次 ----
  const buckets = new Map();
  const bump = (dateStr, key) => {
    if (!dateStr) return;
    const w = weekStart(dateStr);
    if (!w) return;
    if (!buckets.has(w)) buckets.set(w, { applied: 0, replied: 0, meeting: 0, won: 0 });
    buckets.get(w)[key]++;
  };
  for (const r of records) {
    bump(r.applied_at, "applied");
    bump(r.replied_at, "replied");
    bump(r.meeting_at, "meeting");
    if (r.status === "won") bump(r.closed_at, "won");
  }

  const ordered = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-weeks);
  if (ordered.length) {
    console.log(`\n${BOLD}週次（直近${ordered.length}週・週の開始は月曜）${RESET}`);
    table(
      ["週", "応募", "返信", "面談", "成約"],
      ordered.map(([w, v]) => [w, String(v.applied), String(v.replied), String(v.meeting), String(v.won)]),
    );
    const lastTwo = ordered.slice(-2).reduce((s, [, v]) => s + v.applied, 0);
    if (lastTwo === 0) {
      console.log(`\n${BOLD}直近2週の応募数がゼロです。${RESET}供給が止まっているのか、記録が漏れているのかを先に確認してください。`);
    }
  }

  // ---- 媒体別 ----
  const byPlatform = new Map();
  for (const r of records) {
    const k = r.platform || "(未記録)";
    if (!byPlatform.has(k)) byPlatform.set(k, { applied: 0, replied: 0, meeting: 0, won: 0 });
    const v = byPlatform.get(k);
    v.applied++;
    if (reached(r, "replied")) v.replied++;
    if (reached(r, "meeting")) v.meeting++;
    if (r.status === "won") v.won++;
  }
  console.log(`\n${BOLD}媒体別${RESET}`);
  table(
    ["媒体", "応募", "返信", "返信率", "面談", "成約"],
    [...byPlatform.entries()]
      .sort((a, b) => b[1].applied - a[1].applied)
      .map(([k, v]) => [k, String(v.applied), String(v.replied), pct(v.replied, v.applied), String(v.meeting), String(v.won)]),
  );

  console.log(`\n${DIM}追客が必要な案件: node scripts/sales.mjs stale${RESET}`);
}

async function cmdDraft(positional, flags) {
  const [id] = positional;
  if (!id) die("ID を指定してください");

  const records = readLog();
  const rec = records.find((r) => r.id === String(id));
  if (!rec) die(`#${id} が見つかりません`);
  if (!rec.job_type) die(`#${id} に job_type がありません。node scripts/sales.mjs set ${id} --job_type sns のように設定してください`);

  const templatePath = path.join(SALES, "templates", `${rec.job_type}.md`);
  if (!fs.existsSync(templatePath)) die(`テンプレートがありません: ${templatePath}`);

  const profile = loadJson(path.join(SALES, "profile.json"));
  const { platforms } = loadJson(path.join(SALES, "platforms.json"));
  const platform = platforms.find((p) => p.id === rec.platform);
  const template = fs.readFileSync(templatePath, "utf8");

  const jobDescription = flags.jd
    ? fs.readFileSync(flags.jd, "utf8")
    : (flags.job ?? "");

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  let client;
  try {
    client = new Anthropic();
  } catch {
    die("Claude の認証情報が見つかりません。.env.local に ANTHROPIC_API_KEY を設定するか、`export ANTHROPIC_API_KEY=sk-ant-...` してから再実行してください。");
  }

  const system = [
    "あなたは日本語で複業・業務委託案件への応募文を書くライターです。",
    "与えられたテンプレートの方針に厳密に従い、プロフィールに書かれていない実績を絶対に創作しないでください。",
    "数値を書くときはプロフィールにある値だけを使い、規模が募集要項に届かない場合は正直にその旨を書いて勝てる軸にずらしてください。",
    "出力は応募文の本文のみ。前置き・後書き・見出し・箇条書きの装飾は不要です。",
  ].join("\n");

  const prompt = `## テンプレート（この方針に従う）

${template}

## 応募者プロフィール（ここにある事実のみ使用可）

${JSON.stringify(profile, null, 2)}

## 応募先

- 媒体: ${platform?.name ?? rec.platform ?? "不明"}
- 企業: ${rec.company}
- 案件名: ${rec.title || "（未記入）"}
- 条件: ${rec.rate || "（未記入）"}
- URL: ${rec.url || "（なし）"}
- メモ: ${rec.note || "（なし）"}

## 募集要項

${jobDescription || "（未提供。案件名とメモから推測せず、汎用性を保った上でテンプレートの構成に従うこと。推測した募集条件を事実として書かないこと。）"}

上記をもとに応募文を1本書いてください。`;

  const response = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system,
    messages: [{ role: "user", content: prompt }],
  });

  if (response.stop_reason === "refusal") {
    die(`生成が拒否されました: ${response.stop_details?.explanation ?? "理由不明"}`);
  }

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  fs.mkdirSync(DRAFTS_DIR, { recursive: true });
  const slug = rec.company.replace(/[\/\\:*?"<>|\s]/g, "_");
  const out = path.join(DRAFTS_DIR, `${rec.id}-${slug}.md`);
  fs.writeFileSync(out, `${text}\n`, "utf8");

  console.log(text);
  console.log(`\n${DIM}保存: ${path.relative(ROOT, out)}${RESET}`);
  console.log(`${DIM}送信したら: node scripts/sales.mjs set ${rec.id} applied${RESET}`);
}

function usage() {
  console.log(`半自動営業 CLI

  platforms                              媒体一覧と登録状況
  add --platform <id> --company <名前>    応募を記録
       [--title --url --type --rate --note --date]
  draft <id> [--jd <募集要項のファイル>]   応募文のドラフトを生成（要 ANTHROPIC_API_KEY）
       [--job "<募集要項を直接指定>"]
  set <id> [<status>] [--note ...]        ステータス・項目を更新
  list [--status <s>] [--platform <id>]   応募ログを一覧
  stale                                   追客が必要な案件を検出
  report [--weeks 6]                      ファネル・週次・媒体別の集計

  status: ${STATUSES.join(" / ")}
  type:   ${Object.keys(JOB_TYPES).join(" / ")}`);
}

// ---------------------------------------------------------------- main

const { positional, flags } = parseArgs(process.argv.slice(2));
const [command, ...rest] = positional;

try {
  switch (command) {
    case "platforms": cmdPlatforms(); break;
    case "add": cmdAdd(flags); break;
    case "set": cmdSet(rest, flags); break;
    case "list": cmdList(flags); break;
    case "stale": cmdStale(flags); break;
    case "report": cmdReport(flags); break;
    case "draft": await cmdDraft(rest, flags); break;
    default: usage(); if (command) process.exitCode = 1;
  }
} catch (err) {
  die(err?.message ?? String(err));
}
