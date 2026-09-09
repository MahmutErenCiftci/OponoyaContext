"use client";

/** Last-resort boundary for failures in the root layout itself; it must render its own document. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#090a0c", color: "#f3f5f7", fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section role="alert" style={{ maxWidth: 480, border: "1px solid #252931", borderRadius: 16, padding: 32, background: "#111317" }}>
            <h1 style={{ fontSize: 22, margin: "0 0 12px" }}>DevContext could not start this page.</h1>
            <p style={{ color: "#8b929d", lineHeight: 1.6, margin: "0 0 20px" }}>Nothing you saved is affected. Reload to try again.</p>
            {error.digest && <p style={{ color: "#8b929d", fontSize: 12 }}>Reference: {error.digest}</p>}
            <button onClick={() => reset()} style={{ background: "#c9ff55", color: "#0a0c08", border: 0, borderRadius: 10, padding: "12px 18px", fontWeight: 700, cursor: "pointer" }} type="button">Tekrar dene</button>
          </section>
        </main>
      </body>
    </html>
  );
}
