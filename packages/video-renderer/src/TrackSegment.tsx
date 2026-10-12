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
  /** Overrides the long-form Episode's countdown/reveal pacing — undefined keeps COUNTDOWN_FRAMES/REVEAL_FRAMES. Used by Short.tsx for its own faster pacing (see constants.ts). */
  readonly countdownFrames?: number;
  readonly revealFrames?: number;
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
  countdownFrames = COUNTDOWN_FRAMES,
  revealFrames = REVEAL_FRAMES,
}: TrackSegmentProps): ReactElement {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
      <Sequence durationInFrames={countdownFrames}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <CountdownRing
            durationInFrames={countdownFrames}
            accentColor={accentColor}
            {...(ringSize !== undefined ? { size: ringSize } : {})}
          />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={countdownFrames} durationInFrames={revealFrames}>
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
