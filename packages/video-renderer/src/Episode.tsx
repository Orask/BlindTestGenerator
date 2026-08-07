import type { ReactElement } from "react";
import { Series } from "remotion";
import { COUNTDOWN_SECONDS, INTRO_FRAMES, OUTRO_FRAMES, SEGMENT_FRAMES } from "./constants";
import type { EpisodeProps } from "./episode-schema";
import { Intro } from "./Intro";
import { Outro } from "./Outro";
import { TrackSegment } from "./TrackSegment";

export function Episode({ themeLabel, tracks, accentColors }: EpisodeProps): ReactElement {
  const firstAccentColor = accentColors[0]!;

  return (
    <Series>
      <Series.Sequence durationInFrames={INTRO_FRAMES}>
        <Intro
          themeLabel={themeLabel}
          trackCount={tracks.length}
          secondsPerTrack={COUNTDOWN_SECONDS}
          accentColor={firstAccentColor}
        />
      </Series.Sequence>

      {tracks.map((track, index) => (
        <Series.Sequence key={`${track.title}-${index}`} durationInFrames={SEGMENT_FRAMES}>
          <TrackSegment
            title={track.title}
            artist={track.artist}
            albumCoverUrl={track.albumCoverUrl}
            audioUrl={track.audioUrl}
            accentColor={accentColors[index % accentColors.length]!}
            trackNumber={index + 1}
            totalTracks={tracks.length}
          />
        </Series.Sequence>
      ))}

      <Series.Sequence durationInFrames={OUTRO_FRAMES}>
        <Outro accentColor={firstAccentColor} />
      </Series.Sequence>
    </Series>
  );
}
