"use client";

/**
 * Next.js のルート error boundary。
 * app/error.tsx 自体が落ちる場合や、layout.tsx で発生したエラーを
 * 捕捉して、生のエラー詳細を画面に出す最後のセーフティネット。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          fontFamily: "-apple-system, sans-serif",
          padding: "20px",
          background: "#fef2f2",
          color: "#1a1a1a",
        }}
      >
        <div
          style={{
            maxWidth: 800,
            margin: "20px auto",
            background: "#fff",
            border: "2px solid #dc2626",
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h1 style={{ color: "#991b1b", marginBottom: 12 }}>
            ⚠ ルートレベルのエラー
          </h1>
          <p style={{ fontSize: 14, color: "#7f1d1d", marginBottom: 12 }}>
            error.tsx が捕捉できない場所で例外が発生しました。
          </p>
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 4,
              padding: 12,
              fontFamily: "monospace",
              fontSize: 12,
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
            }}
          >
            <div>
              <strong>name:</strong> {error.name}
            </div>
            <div>
              <strong>message:</strong> {error.message}
            </div>
            {error.digest && (
              <div>
                <strong>digest:</strong> {error.digest}
              </div>
            )}
            {error.stack && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: "pointer", color: "#991b1b" }}>
                  stack trace
                </summary>
                <pre
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    lineHeight: 1.4,
                    overflow: "auto",
                  }}
                >
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <button
              onClick={reset}
              style={{
                padding: "8px 16px",
                background: "#dc2626",
                color: "#fff",
                border: 0,
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              再試行
            </button>
            <a
              href="/"
              style={{
                padding: "8px 16px",
                background: "#fff",
                color: "#374151",
                textDecoration: "none",
                border: "1px solid #d1d5db",
                borderRadius: 4,
              }}
            >
              トップへ戻る
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
