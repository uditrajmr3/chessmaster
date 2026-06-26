import { ImageResponse } from "next/og";

export const alt = "ChessInt — Chess Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded share card. Rendered server-side with next/og (Satori): navy
// Moonwalker ground, taupe wordmark, wine accent — matching the app theme.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "#0b141d",
          padding: "90px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            letterSpacing: 8,
            color: "#cf3c79",
            fontWeight: 600,
          }}
        >
          SINCE 2026
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 150,
            fontWeight: 800,
            color: "#eaf0f3",
            marginTop: 12,
            lineHeight: 1,
          }}
        >
          ChessInt
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 44,
            color: "#c2ad95",
            marginTop: 14,
            fontWeight: 600,
          }}
        >
          Chess Intelligence
        </div>
        <div
          style={{
            display: "flex",
            width: 120,
            height: 5,
            background: "#cf3c79",
            borderRadius: 4,
            marginTop: 36,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "#90a2b1",
            marginTop: 36,
          }}
        >
          Analyze every game. Find your patterns. Fix your weaknesses.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            color: "#637688",
            marginTop: 64,
          }}
        >
          chessmaster.cyou
        </div>
      </div>
    ),
    { ...size }
  );
}
