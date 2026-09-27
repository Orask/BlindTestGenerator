import type { ReactElement } from "react";
import { AbsoluteFill, Img } from "remotion";
import { baloo2FontFamily, poppinsFontFamily } from "./fonts";
import type { ThumbnailProps } from "./thumbnail-schema";

const GRID_COLS = 8;
const GRID_ROWS = 5;

// Hand-tuned per artist-photo count so each layout reads as a deliberate
// collage, not a mechanically even row — a slight stagger in size/rotation
// is what makes a thumbnail look designed instead of templated (confirmed
// against several high-performing blind-test thumbnails used as reference).
const HERO_LAYOUTS: Record<
  number,
  { left: number; bottom: number; size: number; rotate: number }[]
> = {
  1: [{ left: 50, bottom: 0, size: 460, rotate: 0 }],
  2: [
    { left: 27, bottom: 0, size: 380, rotate: -4 },
    { left: 73, bottom: 0, size: 380, rotate: 4 },
  ],
  3: [
    { left: 18, bottom: 0, size: 340, rotate: -5 },
    { left: 50, bottom: 4, size: 380, rotate: 0 },
    { left: 82, bottom: 0, size: 340, rotate: 5 },
  ],
  4: [
    { left: 14, bottom: 0, size: 300, rotate: -6 },
    { left: 38, bottom: 6, size: 320, rotate: 3 },
    { left: 62, bottom: 6, size: 320, rotate: -3 },
    { left: 86, bottom: 0, size: 300, rotate: 6 },
  ],
  5: [
    { left: 11, bottom: 0, size: 270, rotate: -7 },
    { left: 31, bottom: 5, size: 290, rotate: 4 },
    { left: 50, bottom: 8, size: 300, rotate: 0 },
    { left: 69, bottom: 5, size: 290, rotate: -4 },
    { left: 89, bottom: 0, size: 270, rotate: 7 },
  ],
  6: [
    { left: 9, bottom: 0, size: 240, rotate: -8 },
    { left: 26, bottom: 4, size: 260, rotate: 5 },
    { left: 43, bottom: 7, size: 270, rotate: -3 },
    { left: 57, bottom: 7, size: 270, rotate: 3 },
    { left: 74, bottom: 4, size: 260, rotate: -5 },
    { left: 91, bottom: 0, size: 240, rotate: 8 },
  ],
};

function HeroCollage({
  imageUrls,
  accentColor,
}: {
  imageUrls: readonly string[];
  accentColor: string;
}): ReactElement | null {
  const shown = imageUrls.slice(0, 6);
  const layout = HERO_LAYOUTS[shown.length];
  if (!layout) {
    return null;
  }

  return (
    <>
      {shown.map((url, index) => {
        const spot = layout[index]!;
        return (
          <div
            key={url}
            style={{
              position: "absolute",
              left: `${spot.left}%`,
              bottom: spot.bottom,
              width: spot.size,
              height: spot.size,
              transform: `translateX(-50%) rotate(${spot.rotate}deg)`,
              borderRadius: 28,
              overflow: "hidden",
              border: `6px solid ${accentColor}`,
              boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
            }}
          >
            <Img src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        );
      })}
    </>
  );
}

function CoverGridFallback({
  coverImageUrls,
}: {
  coverImageUrls: readonly string[];
}): ReactElement {
  const cells = Array.from({ length: GRID_COLS * GRID_ROWS }, (_, index) => index);
  return (
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
  );
}

// Three stacked copies of the same text (glow, black outline, white fill) —
// -webkit-text-stroke only draws one stroke, so a soft colored halo plus a
// crisp black outline underneath the white fill (the "bold comic" look every
// high-performing reference thumbnail uses) needs separate layers.
function OutlinedText({
  children,
  fontSize,
  accentColor,
  fontFamily,
}: {
  children: string;
  fontSize: number;
  accentColor: string;
  fontFamily: string;
}): ReactElement {
  const shared = {
    fontFamily,
    fontWeight: 800 as const,
    fontSize,
    letterSpacing: 2,
    textAlign: "center" as const,
    lineHeight: 1,
    gridArea: "1 / 1",
  };
  return (
    <div style={{ display: "grid" }}>
      {/* Subtle colored halo behind everything — a mood light, not the outline itself. */}
      <div
        style={{
          ...shared,
          color: "transparent",
          WebkitTextStroke: `${fontSize * 0.22}px ${accentColor}`,
          filter: "blur(14px)",
          opacity: 0.55,
        }}
      >
        {children}
      </div>
      {/* Crisp black outline — this is what makes the white fill pop and stay readable over any photo. */}
      <div
        style={{
          ...shared,
          color: "transparent",
          WebkitTextStroke: `${fontSize * 0.14}px black`,
        }}
      >
        {children}
      </div>
      <div
        style={{
          ...shared,
          color: "white",
          textShadow: `0 4px 0 ${accentColor}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function Thumbnail({
  themeLabel,
  trackCount,
  coverImageUrls,
  artistImageUrls,
  accentColor,
}: ThumbnailProps): ReactElement {
  const hasHeroes = artistImageUrls.length > 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0b0b10" }}>
      <AbsoluteFill
        style={{
          background:
            `radial-gradient(ellipse 900px 500px at 50% 30%, ${accentColor}33 0%, transparent 70%),` +
            "linear-gradient(180deg, #0b0b10 0%, #0b0b10 55%, #050507 100%)",
        }}
      />

      {hasHeroes ? (
        <HeroCollage imageUrls={artistImageUrls} accentColor={accentColor} />
      ) : (
        <>
          <CoverGridFallback coverImageUrls={coverImageUrls} />
          <AbsoluteFill
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(11,11,16,0.97) 0%, rgba(11,11,16,0.9) 40%, rgba(11,11,16,0.35) 70%, rgba(11,11,16,0.05) 100%)",
            }}
          />
        </>
      )}

      {/* Darkens the lower band so hero photos never fight the text above them for contrast. */}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(11,11,16,0) 0%, rgba(11,11,16,0.55) 62%, rgba(11,11,16,0.92) 100%)",
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-start",
          flexDirection: "column",
          paddingTop: 96,
        }}
      >
        <OutlinedText fontSize={124} accentColor={accentColor} fontFamily={baloo2FontFamily}>
          BLIND TEST
        </OutlinedText>
        <div
          style={{
            fontFamily: poppinsFontFamily,
            fontWeight: 800,
            fontSize: 56,
            color: accentColor,
            textAlign: "center",
            marginTop: 6,
            textShadow: "0 4px 16px rgba(0,0,0,0.8)",
            maxWidth: 1140,
          }}
        >
          {themeLabel.toUpperCase()}
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          top: 32,
          right: 32,
          fontFamily: poppinsFontFamily,
          fontWeight: 700,
          fontSize: 30,
          color: "white",
          background: "rgba(0,0,0,0.55)",
          border: `2px solid ${accentColor}`,
          borderRadius: 999,
          padding: "10px 26px",
        }}
      >
        {trackCount} morceaux 🎧
      </div>
    </AbsoluteFill>
  );
}
