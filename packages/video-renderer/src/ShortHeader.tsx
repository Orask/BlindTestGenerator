import type { ReactElement } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { poppinsFontFamily as fontFamily } from "./fonts";

export const SHORT_HEADER_FRAMES = 75; // 2.5s at 30fps — long enough to read, short enough to never compete with the hook.

export interface ShortHeaderProps {
  readonly label: string;
  readonly accentColor: string;
}

// A non-blocking overlay, NOT a separate intro scene: 2026 Shorts retention
// research is explicit that the first 2-3 seconds decide the swipe, and a
// full-screen title card before the actual content starts is exactly the
// "context dump" pattern that research flags as underperforming (see
// docs/CLOUD_SESSION_LOG.md). This renders on top of the first TrackSegment
// while its countdown ring is already animating from frame 0 — the
// strongest visual element is on screen immediately, this is just a small
// caption layered over it, not a scene the viewer has to wait through.
export function ShortHeader({ label, accentColor }: ShortHeaderProps): ReactElement {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 10, SHORT_HEADER_FRAMES - 15, SHORT_HEADER_FRAMES],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 96,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity,
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: 38,
          color: "white",
          background: "rgba(0,0,0,0.45)",
          border: `2px solid ${accentColor}`,
          borderRadius: 999,
          padding: "12px 32px",
        }}
      >
        🎧 {label}
      </div>
    </div>
  );
}
