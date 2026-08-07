import type { ReactElement } from "react";
import { poppinsFontFamily as fontFamily } from "./fonts";

export interface TrackNumberBadgeProps {
  readonly trackNumber: number;
  readonly totalTracks: number;
}

export function TrackNumberBadge({
  trackNumber,
  totalTracks,
}: TrackNumberBadgeProps): ReactElement {
  return (
    <div
      style={{
        position: "absolute",
        top: 40,
        left: 48,
        fontFamily,
        fontWeight: 600,
        fontSize: 32,
        color: "rgba(255,255,255,0.85)",
        letterSpacing: 1,
      }}
    >
      {trackNumber} / {totalTracks}
    </div>
  );
}
