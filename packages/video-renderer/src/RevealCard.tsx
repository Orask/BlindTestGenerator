import type { ReactElement } from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Tuned for the 16:9 Episode composition. The vertical Short composition
// passes a larger `coverSize` so the reveal fills more of its taller
// canvas — title/artist font sizes scale with it (ratios below match this
// default), same reasoning as CountdownRing's `size` prop.
const DEFAULT_COVER_SIZE = 360;
const TITLE_FONT_RATIO = 48 / DEFAULT_COVER_SIZE;
const ARTIST_FONT_RATIO = 32 / DEFAULT_COVER_SIZE;

export interface RevealCardProps {
  readonly title: string;
  readonly artist: string;
  readonly albumCoverUrl: string;
  readonly accentColor: string;
  /** Album cover side length in px — defaults to the long-form Episode's size, unchanged. */
  readonly coverSize?: number;
}

const FLASH_FRAMES = 8;

export function RevealCard({
  title,
  artist,
  albumCoverUrl,
  accentColor,
  coverSize = DEFAULT_COVER_SIZE,
}: RevealCardProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const flashOpacity = interpolate(frame, [0, FLASH_FRAMES], [1, 0], {
    extrapolateRight: "clamp",
  });

  const zoom = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 120 },
    durationInFrames: 30,
  });
  const coverScale = interpolate(zoom, [0, 1], [0.4, 1]);

  const textSpring = spring({
    frame: frame - 12,
    fps,
    config: { damping: 16 },
    durationInFrames: 25,
  });
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1], { extrapolateLeft: "clamp" });
  const textY = interpolate(textSpring, [0, 1], [30, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{ backgroundColor: "#0d0d0d", justifyContent: "center", alignItems: "center" }}
    >
      <div
        style={{
          width: coverSize,
          height: coverSize,
          borderRadius: 24,
          overflow: "hidden",
          transform: `scale(${coverScale})`,
          boxShadow: `0 0 120px 20px ${accentColor}`,
        }}
      >
        <Img src={albumCoverUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div
        style={{
          marginTop: 32,
          textAlign: "center",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            fontSize: coverSize * TITLE_FONT_RATIO,
            fontWeight: 700,
            color: "white",
            fontFamily: "sans-serif",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: coverSize * ARTIST_FONT_RATIO,
            color: accentColor,
            fontFamily: "sans-serif",
            marginTop: 8,
          }}
        >
          {artist}
        </div>
      </div>
      <AbsoluteFill style={{ backgroundColor: "white", opacity: flashOpacity }} />
    </AbsoluteFill>
  );
}
