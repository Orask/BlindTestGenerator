import type { ReactElement } from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { COUNTDOWN_FRAMES, REVEAL_FRAMES } from "./constants";
import { CountdownRing } from "./CountdownRing";
import { RevealCard } from "./RevealCard";
import { TrackNumberBadge } from "./TrackNumberBadge";

export interface TrackSegmentProps {
  readonly title: string;
  readonly artist: string;
  readonly albumCoverUrl: string;
  readonly accentColor: string;
  readonly trackNumber: number;
  readonly totalTracks: number;
  /** Passed straight through to CountdownRing/RevealCard — undefined keeps their own (long-form Episode) defaults. */
  readonly ringSize?: number;
  readonly coverSize?: number;
}

export function TrackSegment({
  title,
  artist,
  albumCoverUrl,
  accentColor,
  trackNumber,
  totalTracks,
  ringSize,
  coverSize,
}: TrackSegmentProps): ReactElement {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
      <Sequence durationInFrames={COUNTDOWN_FRAMES}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <CountdownRing
            durationInFrames={COUNTDOWN_FRAMES}
            accentColor={accentColor}
            {...(ringSize !== undefined ? { size: ringSize } : {})}
          />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={COUNTDOWN_FRAMES} durationInFrames={REVEAL_FRAMES}>
        <RevealCard
          title={title}
          artist={artist}
          albumCoverUrl={albumCoverUrl}
          accentColor={accentColor}
          {...(coverSize !== undefined ? { coverSize } : {})}
        />
      </Sequence>
      {/* Rendered last so it stacks above the reveal card's opaque background. */}
      <TrackNumberBadge trackNumber={trackNumber} totalTracks={totalTracks} />
    </AbsoluteFill>
  );
}
