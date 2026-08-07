import type { ReactElement } from "react";
import { Composition } from "remotion";
import { SEGMENT_FRAMES, FPS } from "./constants";
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

export function RemotionRoot(): ReactElement {
  return (
    <Composition
      id="Episode"
      component={Episode}
      schema={episodeSchema}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={SEGMENT_FRAMES * SAMPLE_TRACKS.length}
      defaultProps={{
        tracks: SAMPLE_TRACKS,
        accentColors: ["#ff5f6d", "#4facfe", "#f6d365"],
      }}
      calculateMetadata={({ props }) => ({
        durationInFrames: props.tracks.length * SEGMENT_FRAMES,
      })}
    />
  );
}
