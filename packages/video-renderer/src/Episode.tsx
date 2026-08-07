import type { ReactElement } from "react";
import { Series } from "remotion";
import { SEGMENT_FRAMES } from "./constants";
import type { EpisodeProps } from "./episode-schema";
import { TrackSegment } from "./TrackSegment";

export function Episode({ tracks, accentColors }: EpisodeProps): ReactElement {
  return (
    <Series>
      {tracks.map((track, index) => (
        <Series.Sequence key={`${track.title}-${index}`} durationInFrames={SEGMENT_FRAMES}>
          <TrackSegment
            title={track.title}
            artist={track.artist}
            albumCoverUrl={track.albumCoverUrl}
            audioUrl={track.audioUrl}
            accentColor={accentColors[index % accentColors.length]!}
          />
        </Series.Sequence>
      ))}
    </Series>
  );
}
