import type { ReactElement } from "react";
import { Sequence, Series } from "remotion";
import { CROSSFADE_FRAMES, SEGMENT_FRAMES } from "./constants";
import { CrossfadeAudio } from "./CrossfadeAudio";
import type { ShortProps } from "./short-schema";
import { SHORT_HEADER_FRAMES, ShortHeader } from "./ShortHeader";
import { SHORT_OUTRO_FRAMES, ShortOutro } from "./ShortOutro";
import { TrackSegment } from "./TrackSegment";

// Sized well above the long-form Episode's 340/360px defaults so the
// centered content fills much more of the Short's 1080x1920 vertical
// canvas instead of floating in empty space top/bottom (the visual defect
// this session was asked to fix first — see docs/CLOUD_SESSION_LOG.md).
const SHORT_RING_SIZE = 620;
const SHORT_COVER_SIZE = 620;

export function totalShortDurationInFrames(trackCount: number): number {
  return trackCount * SEGMENT_FRAMES + SHORT_OUTRO_FRAMES;
}

// A vertical (9:16) mini blind-test cut from an already-published episode's
// opening tracks (see apps/pipeline/src/generate-short.ts) — same
// TrackSegment gameplay unit as the long-form Episode composition, just
// rendered larger (see SHORT_RING_SIZE/SHORT_COVER_SIZE above) since it was
// already built centered/AbsoluteFill-based with no assumption about aspect
// ratio or size.
//
// No blocking intro scene: 2026 Shorts retention research is explicit that
// the first 2-3 seconds decide whether a viewer swipes away, and a
// full-screen title card before the action starts is exactly the kind of
// delay that underperforms (see docs/CLOUD_SESSION_LOG.md). The countdown
// ring for track 1 is on screen and animating from frame 0; ShortHeader is
// a caption layered on top of it, not a scene the viewer waits through.
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
        {tracks.map((track, index) => (
          <Series.Sequence key={`${track.title}-${index}`} durationInFrames={SEGMENT_FRAMES}>
            <TrackSegment
              title={track.title}
              artist={track.artist}
              albumCoverUrl={track.albumCoverUrl}
              accentColor={accentColors[index % accentColors.length]!}
              trackNumber={index + 1}
              totalTracks={tracks.length}
              ringSize={SHORT_RING_SIZE}
              coverSize={SHORT_COVER_SIZE}
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

      <Sequence durationInFrames={SHORT_HEADER_FRAMES}>
        <ShortHeader label={themeLabel} accentColor={firstAccentColor} />
      </Sequence>

      {/* Same reasoning as Episode.tsx: a flat timeline so audio can bleed past its Series.Sequence boundary to actually crossfade. */}
      {tracks.map((track, index) => {
        if (!track.audioUrl) {
          return null;
        }
        const segmentStart = index * SEGMENT_FRAMES;
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
