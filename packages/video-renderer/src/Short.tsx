import type { ReactElement } from "react";
import { Sequence, Series } from "remotion";
import { COUNTDOWN_SECONDS, CROSSFADE_FRAMES, SEGMENT_FRAMES } from "./constants";
import { CrossfadeAudio } from "./CrossfadeAudio";
import type { ShortProps } from "./short-schema";
import { SHORT_INTRO_FRAMES, ShortIntro } from "./ShortIntro";
import { SHORT_OUTRO_FRAMES, ShortOutro } from "./ShortOutro";
import { TrackSegment } from "./TrackSegment";

export function totalShortDurationInFrames(trackCount: number): number {
  return SHORT_INTRO_FRAMES + trackCount * SEGMENT_FRAMES + SHORT_OUTRO_FRAMES;
}

// A vertical (9:16) mini blind-test cut from an already-published episode's
// opening tracks (see apps/pipeline/src/generate-short.ts) — same
// TrackSegment gameplay unit as the long-form Episode composition, unmodified:
// it was already built centered/AbsoluteFill-based with no assumption about
// aspect ratio, so it drops into a vertical canvas with zero changes.
export function Short({
  themeLabel,
  tracks,
  fullEpisodeTrackCount,
  accentColors,
}: ShortProps): ReactElement {
  const firstAccentColor = accentColors[0]!;

  return (
    <>
      <Series>
        <Series.Sequence durationInFrames={SHORT_INTRO_FRAMES}>
          <ShortIntro
            themeLabel={themeLabel}
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

        <Series.Sequence durationInFrames={SHORT_OUTRO_FRAMES}>
          <ShortOutro
            fullEpisodeTrackCount={fullEpisodeTrackCount}
            accentColor={firstAccentColor}
          />
        </Series.Sequence>
      </Series>

      {/* Same reasoning as Episode.tsx: a flat timeline so audio can bleed past its Series.Sequence boundary to actually crossfade. */}
      {tracks.map((track, index) => {
        if (!track.audioUrl) {
          return null;
        }
        const segmentStart = SHORT_INTRO_FRAMES + index * SEGMENT_FRAMES;
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
