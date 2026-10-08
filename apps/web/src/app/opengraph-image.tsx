import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "48px 64px",
          background: "linear-gradient(135deg, #0f172a 0%, #312e81 55%, #7c3aed 100%)",
          color: "white",
          fontFamily: "sans-serif"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%"
          }}
        >
          <div style={{ fontSize: 32, letterSpacing: 6, opacity: 0.8 }}>FINADVISOR</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
              Financial plans for growth
            </div>
            <div style={{ fontSize: 28, opacity: 0.9 }}>
              Restaurant founders • banks • investors
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
