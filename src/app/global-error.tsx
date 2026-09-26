"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "monospace",
          display: "flex",
          height: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
        }}
      >
        <p style={{ margin: 0, fontSize: "14px" }}>something went very wrong</p>
        <p style={{ margin: 0, fontSize: "12px", opacity: 0.5 }}>
          capy couldn&apos;t recover from this one
        </p>
        <button
          onClick={reset}
          style={{
            border: "1px solid currentColor",
            padding: "4px 12px",
            fontFamily: "monospace",
            fontSize: "12px",
            cursor: "pointer",
            background: "transparent",
            color: "inherit",
            marginTop: "4px",
          }}
        >
          reload
        </button>
      </body>
    </html>
  );
}
