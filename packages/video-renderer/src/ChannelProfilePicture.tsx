import type { ReactElement } from "react";
import { AbsoluteFill } from "remotion";
import { baloo2FontFamily } from "./fonts";

// YouTube displays this cropped to a circle at various sizes down to ~98px —
// everything meaningful stays within the inner ~82% so nothing gets clipped
// by the circular mask or lost to compression at small sizes.
export const CHANNEL_PROFILE_SIZE = 800;

export function ChannelProfilePicture(): ReactElement {
  const accentColor = "#ff5f6d";
  const accent2 = "#4facfe";

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 35% 30%, ${accent2} 0%, #0b0b10 55%, #050507 100%)`,
      }}
    >
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: baloo2FontFamily,
            fontWeight: 700,
            fontSize: 340,
            color: "white",
            letterSpacing: -4,
            lineHeight: 1,
            WebkitTextStroke: `10px ${accentColor}`,
            paintOrder: "stroke fill",
            textShadow: `0 0 60px ${accentColor}aa`,
          }}
        >
          BT
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
