import { ImageResponse } from "next/og";

export const alt = "Aurelia residences — Live above the skyline";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "#F5F2EC", background: "linear-gradient(135deg, #0A0A0B, #4b4030)" }}>
      <div style={{ display: "flex", fontSize: 28, letterSpacing: 12, color: "#D8B67A" }}>AURELIA RESIDENCES</div>
      <div style={{ display: "flex", fontSize: 88, maxWidth: 900, lineHeight: 1.1 }}>Live above the skyline.</div>
      <div style={{ display: "flex", borderTop: "1px solid #D8B67A", paddingTop: 24, fontSize: 20, letterSpacing: 4 }}>A NEW PERSPECTIVE ON HOME</div>
    </div>, size,
  );
}
