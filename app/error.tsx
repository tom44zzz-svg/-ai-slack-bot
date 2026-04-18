"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[page error]", error);
  }, [error]);

  return (
    <main className="max-w-3xl mx-auto p-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-5 space-y-3">
        <h1 className="text-lg font-bold text-red-900">
          エラーが発生しました
        </h1>
        <p className="text-sm text-red-800">
          ページの描画中に例外が発生しました。以下の情報を開発者に共有してください。
        </p>

        <div className="bg-white border border-red-200 rounded p-3 font-mono text-xs whitespace-pre-wrap break-words">
          <div>
            <span className="font-bold">name:</span> {error.name}
          </div>
          <div>
            <span className="font-bold">message:</span> {error.message}
          </div>
          {error.digest && (
            <div>
              <span className="font-bold">digest:</span> {error.digest}
            </div>
          )}
          {error.stack && (
            <details className="mt-2">
              <summary className="cursor-pointer text-red-700">
                stack trace
              </summary>
              <pre className="mt-2 text-[11px] leading-snug">{error.stack}</pre>
            </details>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 rounded bg-red-600 text-white text-sm hover:bg-red-700"
          >
            再試行
          </button>
          <a
            href="/api/health"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded border border-red-300 text-red-700 text-sm hover:bg-red-50"
          >
            /api/health で環境確認
          </a>
          <a
            href="/"
            className="px-4 py-2 rounded border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
          >
            トップへ戻る
          </a>
        </div>
      </div>
    </main>
  );
}
