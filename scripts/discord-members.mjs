#!/usr/bin/env node
/**
 * Discord サーバーのメンバー一覧を、ロール付きで書き出す。
 *
 *   node scripts/discord-members.mjs guilds          Botが参加しているサーバーとIDを表示
 *   node scripts/discord-members.mjs members         メンバー一覧を出力
 *        [--guild <id>] [--out <dir>] [--format md|csv|both]
 *
 * 必要な環境変数:
 *   DISCORD_BOT_TOKEN   Bot のトークン
 *   DISCORD_GUILD_ID    対象サーバーのID（--guild で上書き可）
 *
 * 事前準備（Discord Developer Portal）:
 *   1. Applications → 対象アプリ → Bot → Reset Token でトークンを取得
 *   2. 同じ画面の Privileged Gateway Intents で SERVER MEMBERS INTENT を ON
 *      （これが OFF だと /members が 403 を返します）
 *   3. OAuth2 → URL Generator で scope=bot・permissions=View Channels を選び、
 *      生成されたURLからサーバーにBotを招待
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.DISCORD_API_BASE ?? "https://discord.com/api/v10";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function die(msg) {
  console.error(`エラー: ${msg}`);
  process.exit(1);
}

function token() {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) {
    die("DISCORD_BOT_TOKEN が設定されていません。.env.local に追加するか、`export DISCORD_BOT_TOKEN=...` してください。");
  }
  return t;
}

/** Discord API を叩く。429 はレスポンスの retry_after に従って再試行する。 */
async function api(endpoint, attempt = 0) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: { Authorization: `Bot ${token()}`, "User-Agent": "sales-toolkit (local script)" },
  });

  if (res.status === 429 && attempt < 5) {
    const body = await res.json().catch(() => ({}));
    const wait = Math.ceil((body.retry_after ?? 1) * 1000);
    console.error(`レート制限。${wait}ms 待って再試行します…`);
    await new Promise((r) => setTimeout(r, wait));
    return api(endpoint, attempt + 1);
  }

  if (res.status === 401 || res.status === 403) {
    die([
      `Discord API が ${res.status} を返しました（${endpoint}）。次のいずれかです:`,
      "  1. DISCORD_BOT_TOKEN が無効 → Developer Portal → Bot → Reset Token で取り直す",
      "  2. SERVER MEMBERS INTENT が OFF → 同じ画面の Privileged Gateway Intents を ON にする",
      "  3. Bot がそのサーバーに参加していない → OAuth2 → URL Generator の招待URLから招待する",
    ].join("\n"));
  }
  if (res.status === 404) die(`${endpoint} が見つかりません。サーバーIDが正しいか、Bot が参加しているかを確認してください。`);
  if (!res.ok) die(`Discord API ${res.status}: ${(await res.text()).slice(0, 300)}`);

  return res.json();
}

async function cmdGuilds() {
  const guilds = await api("/users/@me/guilds");
  if (!guilds.length) {
    return console.log("Bot はまだどのサーバーにも参加していません。OAuth2 → URL Generator で招待URLを作って招待してください。");
  }
  console.log("Bot が参加しているサーバー:\n");
  for (const g of guilds) console.log(`  ${g.id}  ${g.name}`);
  console.log("\n使い方: node scripts/discord-members.mjs members --guild <上のID>");
}

/** 1000件ずつ after カーソルで全メンバーを取得する。 */
async function fetchAllMembers(guildId) {
  const members = [];
  let after = "0";
  for (;;) {
    const page = await api(`/guilds/${guildId}/members?limit=1000&after=${after}`);
    if (!page.length) break;
    members.push(...page);
    after = page[page.length - 1].user.id;
    if (page.length < 1000) break;
    console.error(`  ${members.length}件 取得…`);
  }
  return members;
}

async function cmdMembers(flags) {
  const guildId = flags.guild ?? process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    die("サーバーIDが不明です。--guild <id> を渡すか DISCORD_GUILD_ID を設定してください。IDの調べ方: node scripts/discord-members.mjs guilds");
  }

  const guild = await api(`/guilds/${guildId}`);
  const roles = await api(`/guilds/${guildId}/roles`);
  const members = await fetchAllMembers(guildId);

  // @everyone はロールIDがサーバーIDと同じ。全員に付くので表示しない。
  const roleById = new Map(roles.filter((r) => r.id !== guildId).map((r) => [r.id, r]));

  const rows = members.map((m) => {
    const owned = m.roles
      .map((id) => roleById.get(id))
      .filter(Boolean)
      .sort((a, b) => b.position - a.position);
    return {
      displayName: m.nick || m.user.global_name || m.user.username,
      username: m.user.username,
      bot: Boolean(m.user.bot),
      roles: owned.map((r) => r.name),
      topPosition: owned[0]?.position ?? -1,
      joinedAt: (m.joined_at ?? "").slice(0, 10),
    };
  });

  // ロール階層の高い順 → 参加が早い順。役割が一目で分かる並び。
  rows.sort((a, b) => b.topPosition - a.topPosition || a.joinedAt.localeCompare(b.joinedAt));

  const outDir = flags.out ? path.resolve(flags.out) : path.join(ROOT, "sales", "discord");
  fs.mkdirSync(outDir, { recursive: true });
  const format = flags.format ?? "both";
  const slug = guild.name.replace(/[\/\\:*?"<>|\s]/g, "_");
  const written = [];

  if (format === "md" || format === "both") {
    const humans = rows.filter((r) => !r.bot);
    const bots = rows.filter((r) => r.bot);
    const line = (r) => `| ${r.displayName} | ${r.username} | ${r.roles.join(", ") || "—"} | ${r.joinedAt || "—"} |`;
    const md = [
      `# ${guild.name} メンバー一覧`,
      "",
      `メンバー ${humans.length}人（Bot ${bots.length}件を除く）／取得日 ${new Date().toISOString().slice(0, 10)}`,
      "",
      "| 表示名 | ユーザー名 | ロール | 参加日 |",
      "| --- | --- | --- | --- |",
      ...humans.map(line),
      ...(bots.length ? ["", "## Bot", "", "| 表示名 | ユーザー名 | ロール | 参加日 |", "| --- | --- | --- | --- |", ...bots.map(line)] : []),
      "",
      "## ロール別",
      "",
      ...[...roleById.values()]
        .sort((a, b) => b.position - a.position)
        .map((role) => {
          const holders = rows.filter((r) => r.roles.includes(role.name)).map((r) => r.displayName);
          return `- **${role.name}** (${holders.length}人): ${holders.join("、") || "—"}`;
        }),
      "",
    ].join("\n");
    const p = path.join(outDir, `${slug}-members.md`);
    fs.writeFileSync(p, md, "utf8");
    written.push(p);
  }

  if (format === "csv" || format === "both") {
    const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const csv = [
      "display_name,username,is_bot,roles,joined_at",
      ...rows.map((r) => [r.displayName, r.username, r.bot, r.roles.join(" / "), r.joinedAt].map(esc).join(",")),
    ].join("\n") + "\n";
    const p = path.join(outDir, `${slug}-members.csv`);
    fs.writeFileSync(p, csv, "utf8");
    written.push(p);
  }

  console.log(`${guild.name}: ${rows.length}件（うちBot ${rows.filter((r) => r.bot).length}件）／ロール ${roleById.size}種`);
  for (const p of written) console.log(`  → ${path.relative(ROOT, p)}`);
}

// ---------------------------------------------------------------- main

const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const eq = a.indexOf("=");
    if (eq !== -1) flags[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) flags[a.slice(2)] = argv[++i];
    else flags[a.slice(2)] = true;
  } else positional.push(a);
}

const command = positional[0] ?? "members";
if (command === "guilds") await cmdGuilds();
else if (command === "members") await cmdMembers(flags);
else {
  console.log(`使い方:
  node scripts/discord-members.mjs guilds
  node scripts/discord-members.mjs members [--guild <id>] [--out <dir>] [--format md|csv|both]`);
  process.exitCode = 1;
}
