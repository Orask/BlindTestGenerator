import type { ReactElement } from "react";
import { AbsoluteFill, Img } from "remotion";
import { baloo2FontFamily, poppinsFontFamily } from "./fonts";
import type { ThumbnailProps } from "./thumbnail-schema";

const GRID_COLS = 8;
const GRID_ROWS = 5;

export function Thumbnail({
  themeLabel,
  trackCount,
  coverImageUrls,
  accentColor,
}: ThumbnailProps): ReactElement {
  const cells = Array.from({ length: GRID_COLS * GRID_ROWS }, (_, index) => index);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
        }}
      >
        {cells.map((index) => {
          const url = coverImageUrls[index % coverImageUrls.length]!;
          return (
            <div key={index} style={{ overflow: "hidden" }}>
              <Img
                src={url}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "brightness(0.5)",
                }}
              />
            </div>
          );
        })}
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(13,13,13,0.97) 0%, rgba(13,13,13,0.9) 40%, rgba(13,13,13,0.35) 70%, rgba(13,13,13,0.05) 100%)",
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          padding: "0 60px",
        }}
      >
        <div
          style={{
            fontFamily: baloo2FontFamily,
            fontWeight: 700,
            fontSize: 138,
            color: "white",
            letterSpacing: 3,
            textAlign: "center",
            lineHeight: 1,
            WebkitTextStroke: `5px ${accentColor}`,
            paintOrder: "stroke fill",
            textShadow: `0 0 60px ${accentColor}`,
          }}
        >
          BLIND TEST
        </div>
        <div
          style={{
            fontFamily: poppinsFontFamily,
            fontWeight: 800,
            fontSize: 62,
            color: accentColor,
            textAlign: "center",
            marginTop: 14,
            textShadow: "0 4px 16px rgba(0,0,0,0.7)",
            maxWidth: 1100,
          }}
        >
          {themeLabel}
        </div>
        <div
          style={{
            fontFamily: poppinsFontFamily,
            fontWeight: 600,
            fontSize: 38,
            color: "white",
            marginTop: 22,
            textShadow: "0 2px 10px rgba(0,0,0,0.7)",
          }}
        >
          {trackCount} morceaux à deviner 🎧
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
