import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { APP_DOMAIN, APP_TAGLINE, OG_COLORS } from "@/constants";

export const alt = `heycapy — ${APP_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const assets = join(process.cwd(), "src/assets");
const [pixelFont, monoFont, capy] = await Promise.all([
  readFile(join(assets, "fonts/Silkscreen-Regular.ttf")),
  readFile(join(assets, "fonts/GeistMono-Regular.ttf")),
  readFile(join(assets, "og-capy.png")),
]);
const capySrc = `data:image/png;base64,${capy.toString("base64")}`;

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 48,
        padding: "0 80px",
        background: OG_COLORS.background,
        color: OG_COLORS.foreground,
        fontFamily: "Geist Mono",
      }}
    >
      <img src={capySrc} width={320} height={320} alt="" />
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontFamily: "Silkscreen", fontSize: 88, lineHeight: 1 }}>heycapy</div>
        <div style={{ fontSize: 30, color: OG_COLORS.muted }}>{APP_TAGLINE}</div>
        <div style={{ fontSize: 24, marginTop: 24 }}>{APP_DOMAIN}</div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Silkscreen", data: pixelFont, weight: 400, style: "normal" },
        { name: "Geist Mono", data: monoFont, weight: 400, style: "normal" },
      ],
    }
  );
}
