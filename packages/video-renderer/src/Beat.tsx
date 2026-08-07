import type { ReactElement, ReactNode } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export const BEAT_FRAMES = 90;

/** One "slide" of an intro/outro sequence: fades and slides in, holds, fades out. */
export function Beat({ children }: { children: ReactNode }): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeFrames = fps * 0.4;

  const opacity = interpolate(
    frame,
    [0, fadeFrames, BEAT_FRAMES - fadeFrames, BEAT_FRAMES],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const translateY = interpolate(frame, [0, fadeFrames], [20, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}
