import type { ReactElement } from "react";
import { AbsoluteFill } from "remotion";
import { baloo2FontFamily, poppinsFontFamily } from "./fonts";

// YouTube renders this at up to 2560x1440 but only guarantees the centered
// 1546x423 "safe area" is visible on every device (TV, desktop, mobile) —
// everything that matters has to live inside that box; the rest is
// decorative bleed. See https://support.google.com/youtube/answer/2972003.
const CANVAS_WIDTH = 2560;
const CANVAS_HEIGHT = 1440;
const SAFE_WIDTH = 1546;
const SAFE_HEIGHT = 423;

export function ChannelBanner(): ReactElement {
  const accentColor = "#ff5f6d";
  const accent2 = "#4facfe";

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b10" }}>
      <AbsoluteFill
        style={{
          background:
            `radial-gradient(ellipse 1400px 700px at 50% 50%, ${accentColor}26 0%, transparent 65%),` +
            `radial-gradient(ellipse 900px 900px at 85% 15%, ${accent2}22 0%, transparent 60%),` +
            "linear-gradient(180deg, #0b0b10 0%, #050507 100%)",
        }}
      />

      {/* Faint diagonal soundwave-style bars across the full bleed, purely decorative. */}
      <AbsoluteFill
        style={{ display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.16 }}
      >
        <div style={{ display: "flex", gap: 14, transform: "rotate(-6deg)" }}>
          {Array.from({ length: 26 }, (_, i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 60 + Math.abs(((i * 37) % 13) - 6) * 30,
                borderRadius: 6,
                background: i % 2 === 0 ? accentColor : accent2,
              }}
            />
          ))}
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: SAFE_WIDTH,
            height: SAFE_HEIGHT,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontFamily: baloo2FontFamily,
              fontWeight: 700,
              fontSize: 128,
              color: "white",
              letterSpacing: 4,
              lineHeight: 1,
              textAlign: "center",
              WebkitTextStroke: `4px ${accentColor}`,
              paintOrder: "stroke fill",
              textShadow: `0 0 70px ${accentColor}88`,
            }}
          >
            BLIND TEST FR
          </div>
          <div
            style={{
              fontFamily: poppinsFontFamily,
              fontWeight: 600,
              fontSize: 40,
              color: "#e8e8ec",
              marginTop: 18,
              textAlign: "center",
              letterSpacing: 1,
            }}
          >
            Un nouveau thème chaque jour · 60 extraits · 12 secondes chrono 🎧
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export const CHANNEL_BANNER_WIDTH = CANVAS_WIDTH;
export const CHANNEL_BANNER_HEIGHT = CANVAS_HEIGHT;
