import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "フィード投稿 構成案ジェネレーター",
  description: "ネタを入れると Canva フィード投稿の構成案を自動出力",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
