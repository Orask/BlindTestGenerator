import type { ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence } from "remotion";
import { COUNTDOWN_FRAMES, REVEAL_FRAMES } from "./constants";
import { CountdownRing } from "./CountdownRing";
import { RevealCard } from "./RevealCard";
import { TrackNumberBadge } from "./TrackNumberBadge";

export interface TrackSegmentProps {
  readonly title: string;
  readonly artist: string;
  readonly albumCoverUrl: string;
  readonly audioUrl: string | undefined;
  readonly accentColor: string;
  readonly trackNumber: number;
  readonly totalTracks: number;
}

export function TrackSegment({
  title,
  artist,
  albumCoverUrl,
  audioUrl,
  accentColor,
  trackNumber,
  totalTracks,
}: TrackSegmentProps): ReactElement {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
      {audioUrl ? <Audio src={audioUrl} /> : null}
      <Sequence durationInFrames={COUNTDOWN_FRAMES}>
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <CountdownRing durationInFrames={COUNTDOWN_FRAMES} accentColor={accentColor} />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={COUNTDOWN_FRAMES} durationInFrames={REVEAL_FRAMES}>
        <RevealCard
          title={title}
          artist={artist}
          albumCoverUrl={albumCoverUrl}
          accentColor={accentColor}
        />
      </Sequence>
      {/* Rendered last so it stacks above the reveal card's opaque background. */}
      <TrackNumberBadge trackNumber={trackNumber} totalTracks={totalTracks} />
    </AbsoluteFill>
  );
}
