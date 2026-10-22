"use client";

/** Last resort when the root layout itself fails: plain markup, no app fonts or providers. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F5F4EF", color: "#0D0D0D", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif", padding: 20 }}>
        <main style={{ width: "100%", maxWidth: 420, background: "#fff", borderRadius: 28, padding: 32, boxShadow: "inset 0 0 0 1px rgba(13,13,13,.08)" }}>
          <svg aria-hidden="true" height="36" viewBox="0 0 100 100" width="36"><circle cx="50" cy="50" fill="#FF5A4F" r="46" /></svg>
          <p style={{ margin: "20px 0 0", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(13,13,13,.5)" }}>A small pause</p>
          <h1 style={{ margin: "8px 0 0", fontSize: 30, lineHeight: 1.05, letterSpacing: "-0.04em" }}>Setuvara is taking a moment.</h1>
          <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.5, color: "rgba(13,13,13,.6)" }}>Your identity and connections are safe. Try again, or come back in a minute.</p>
          <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
            <button onClick={reset} style={{ minHeight: 48, border: 0, borderRadius: 999, background: "#FF5A4F", color: "#0D0D0D", fontWeight: 600, fontSize: 15, padding: "0 22px", cursor: "pointer" }} type="button">Try again</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- the router may be what failed */}
            <a href="/" style={{ minHeight: 48, display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(13,13,13,.06)", color: "#0D0D0D", fontWeight: 600, fontSize: 15, padding: "0 22px", textDecoration: "none" }}>Home</a>
          </div>
        </main>
      </body>
    </html>
  );
}
