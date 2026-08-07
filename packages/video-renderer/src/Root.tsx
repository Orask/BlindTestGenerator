import type { ReactElement } from "react";
import { Composition } from "remotion";
import { FPS, INTRO_FRAMES, OUTRO_FRAMES, SEGMENT_FRAMES } from "./constants";
import { Episode } from "./Episode";
import { episodeSchema } from "./episode-schema";

const SAMPLE_TRACKS = [
  {
    title: "Dernière danse",
    artist: "Indila",
    albumCoverUrl: "https://picsum.photos/seed/blindtest1/800",
  },
  {
    title: "Papaoutai",
    artist: "Stromae",
    albumCoverUrl: "https://picsum.photos/seed/blindtest2/800",
  },
  {
    title: "Formidable",
    artist: "Stromae",
    albumCoverUrl: "https://picsum.photos/seed/blindtest3/800",
  },
];

function totalDurationInFrames(trackCount: number): number {
  return INTRO_FRAMES + trackCount * SEGMENT_FRAMES + OUTRO_FRAMES;
}

export function RemotionRoot(): ReactElement {
  return (
    <Composition
      id="Episode"
      component={Episode}
      schema={episodeSchema}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={totalDurationInFrames(SAMPLE_TRACKS.length)}
      defaultProps={{
        themeLabel: "Variété actuelle",
        tracks: SAMPLE_TRACKS,
        accentColors: ["#ff5f6d", "#4facfe", "#f6d365"],
      }}
      calculateMetadata={({ props }) => ({
        durationInFrames: totalDurationInFrames(props.tracks.length),
      })}
    />
  );
}
