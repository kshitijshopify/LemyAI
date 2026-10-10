import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

export function ogImage({ title, subtitle, accent = ["#7cf8ff", "#a26bff"], kicker }: { title: string; subtitle: string; accent?: [string, string]; kicker: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: `radial-gradient(900px 500px at 0% 0%, ${accent[0]}33, transparent 60%), radial-gradient(800px 500px at 100% 100%, ${accent[1]}40, transparent 60%), #05060a`,
          color: "#e8ecff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #7cf8ff, #a26bff, #ff5fd2)",
              color: "#05060a",
              fontSize: 38,
              fontWeight: 800,
            }}
          >
            L
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontWeight: 700 }}>Lemy</div>
            <div style={{ fontSize: 18, color: "#858db3", letterSpacing: 4 }}>BY SCRIPT COMMERCE</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 22, letterSpacing: 6, color: accent[0] }}>{kicker.toUpperCase()}</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.02, letterSpacing: -2, maxWidth: 1000 }}>{title}</div>
          <div style={{ fontSize: 32, color: "#c3c9ea", maxWidth: 980 }}>{subtitle}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#858db3" }}>
          <div style={{ display: "flex" }}>lemy.ai/tools</div>
          <div style={{ display: "flex", color: "#4dffb0" }}>Free · No login · Results in under 60s</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
