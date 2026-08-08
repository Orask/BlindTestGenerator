import type { ReactElement } from "react";
import { Audio, interpolate } from "remotion";

export interface CrossfadeAudioProps {
  readonly src: string;
  readonly durationInFrames: number;
  readonly crossfadeFrames: number;
}

/**
 * A track's audio, extended crossfadeFrames past its own segment boundary on
 * both sides so it overlaps with the neighboring track's same extension —
 * volume ramps 0→1 over the lead-in and 1→0 over the tail, turning what
 * would otherwise be a hard cut into a real crossfade.
 */
export function CrossfadeAudio({
  src,
  durationInFrames,
  crossfadeFrames,
}: CrossfadeAudioProps): ReactElement {
  return (
    <Audio
      src={src}
      volume={(frame) =>
        interpolate(
          frame,
          [0, crossfadeFrames, durationInFrames - crossfadeFrames, durationInFrames],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      }
    />
  );
}
