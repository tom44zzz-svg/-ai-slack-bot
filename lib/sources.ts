/**
 * 出典 URL の公的ドメイン判定・検証。
 * 制作ルール 3（国・企業に限る、個人ブログ NG）を機械チェック。
 */

// 最優先ソース（セゾンファンデックス 自社コラム）
const PREFERRED_DOMAINS = ["fundex.co.jp"];
// fundex.co.jp の中でも特に『/contents/』配下を自社コラムとして最優先
const PREFERRED_PATH_PREFIXES = ["/contents/"];

// 公的ドメインのホワイトリスト
const PUBLIC_DOMAIN_SUFFIXES = [
  // 日本の公的機関
  ".go.jp",     // 省庁・政府機関
  ".lg.jp",     // 地方自治体
  ".ac.jp",     // 大学・学術機関
  ".or.jp",     // 公益法人
  // 海外公的機関（将来的な拡張用）
  ".gov",
  ".edu",
];

// 明確に NG な個人ブログ系ドメイン
const PERSONAL_BLOG_DOMAINS = [
  "ameblo.jp",
  "note.com",
  "hatenablog.com",
  "blog.livedoor.jp",
  "blog.goo.ne.jp",
  "fc2.com",
  "seesaa.net",
  "medium.com",
  "wordpress.com",
  "blogger.com",
  "qiita.com",      // 個人の技術記事寄り
  "zenn.dev",
];

// 既知の信頼できる企業・メディア（必要に応じて追加）
const TRUSTED_CORPORATE_DOMAINS = [
  "saisoncard.co.jp", // クレディセゾン
  "reinfolib.mlit.go.jp", // 不動産情報ライブラリ
  "e-gov.go.jp",
  "mof.go.jp",        // 財務省
  "mlit.go.jp",       // 国交省
  "nta.go.jp",        // 国税庁
  "fsa.go.jp",        // 金融庁
  "stat.go.jp",       // 総務省統計局
  "flat35.com",       // 住宅金融支援機構（フラット35）
  "jhf.go.jp",        // 住宅金融支援機構
  "jcba.or.jp",       // 全国銀行協会
  "cic.co.jp",        // 信用情報機関 CIC
  "jicc.co.jp",       // 日本信用情報機構
];

export type SourceVerdict = {
  url: string;
  domain: string;
  classification:
    | "preferred"
    | "official"
    | "corporate_trusted"
    | "corporate_unknown"
    | "personal_blog"
    | "invalid";
  severity: "ok" | "warn" | "block";
  reason: string;
};

export function verifySource(url: string): SourceVerdict {
  let host = "";
  let pathname = "";
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
    pathname = u.pathname;
  } catch {
    return {
      url,
      domain: "",
      classification: "invalid",
      severity: "block",
      reason: "URL の形式が不正",
    };
  }

  // 個人ブログ NG
  for (const d of PERSONAL_BLOG_DOMAINS) {
    if (host === d || host.endsWith("." + d)) {
      return {
        url,
        domain: host,
        classification: "personal_blog",
        severity: "block",
        reason: "個人ブログドメイン（制作ルール 3 抵触）",
      };
    }
  }

  // 最優先：セゾンファンデックス 自社コラム（/contents/ 配下を特に優先）
  for (const d of PREFERRED_DOMAINS) {
    if (host === d || host.endsWith("." + d)) {
      const isColumn = PREFERRED_PATH_PREFIXES.some((p) =>
        pathname.startsWith(p)
      );
      return {
        url,
        domain: host,
        classification: "preferred",
        severity: "ok",
        reason: isColumn
          ? "セゾンファンデックス 自社コラム（最優先ソース）"
          : "セゾンファンデックス 公式サイト",
      };
    }
  }

  // 公的ドメイン
  for (const suf of PUBLIC_DOMAIN_SUFFIXES) {
    if (host.endsWith(suf)) {
      return {
        url,
        domain: host,
        classification: "official",
        severity: "ok",
        reason: `公的ドメイン（${suf}）`,
      };
    }
  }

  // 信頼できる企業
  for (const d of TRUSTED_CORPORATE_DOMAINS) {
    if (host === d || host.endsWith("." + d)) {
      return {
        url,
        domain: host,
        classification: "corporate_trusted",
        severity: "ok",
        reason: "登録済みの信頼企業ドメイン",
      };
    }
  }

  // それ以外の企業ドメインは要確認
  return {
    url,
    domain: host,
    classification: "corporate_unknown",
    severity: "warn",
    reason: "企業ドメインの可能性。公的ソースか要確認（rule_03）",
  };
}

export type Citation = {
  url: string;
  title?: string;
  page_or_section?: string;
  quote?: string;
  accessed_at?: string;
};

export type VerifiedCitation = Citation & { verdict: SourceVerdict };

export function verifyCitations(citations: Citation[]): VerifiedCitation[] {
  return (citations || []).map((c) => ({ ...c, verdict: verifySource(c.url) }));
}
