import type { ReactElement } from "react";
import { Sequence, Series } from "remotion";
import {
  COUNTDOWN_SECONDS,
  CROSSFADE_FRAMES,
  INTRO_FRAMES,
  OUTRO_FRAMES,
  SEGMENT_FRAMES,
} from "./constants";
import { CrossfadeAudio } from "./CrossfadeAudio";
import type { EpisodeProps } from "./episode-schema";
import { Intro } from "./Intro";
import { Outro } from "./Outro";
import { TrackSegment } from "./TrackSegment";

export function Episode({ themeLabel, tracks, accentColors }: EpisodeProps): ReactElement {
  const firstAccentColor = accentColors[0]!;

  return (
    <>
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

      {/*
        Rendered as its own flat timeline (not nested in the Series above)
        because Series.Sequence clips its children to non-overlapping
        boundaries — audio needs to bleed crossfadeFrames into the previous
        and next track's window to actually crossfade instead of cutting.
      */}
      {tracks.map((track, index) => {
        if (!track.audioUrl) {
          return null;
        }
        const segmentStart = INTRO_FRAMES + index * SEGMENT_FRAMES;
        const durationInFrames = SEGMENT_FRAMES + 2 * CROSSFADE_FRAMES;
        return (
          <Sequence
            key={`audio-${track.title}-${index}`}
            from={segmentStart - CROSSFADE_FRAMES}
            durationInFrames={durationInFrames}
          >
            <CrossfadeAudio
              src={track.audioUrl}
              durationInFrames={durationInFrames}
              crossfadeFrames={CROSSFADE_FRAMES}
            />
          </Sequence>
        );
      })}
    </>
  );
}
