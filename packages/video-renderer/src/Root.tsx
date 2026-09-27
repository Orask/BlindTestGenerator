import type { ReactElement } from "react";
import { Composition, Still } from "remotion";
import { CHANNEL_BANNER_HEIGHT, CHANNEL_BANNER_WIDTH, ChannelBanner } from "./ChannelBanner";
import { CHANNEL_PROFILE_SIZE, ChannelProfilePicture } from "./ChannelProfilePicture";
import { FPS, INTRO_FRAMES, OUTRO_FRAMES, SEGMENT_FRAMES } from "./constants";
import { Episode } from "./Episode";
import { episodeSchema } from "./episode-schema";
import { Thumbnail } from "./Thumbnail";
import { thumbnailSchema } from "./thumbnail-schema";

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
    <>
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

      <Still
        id="Thumbnail"
        component={Thumbnail}
        schema={thumbnailSchema}
        width={1280}
        height={720}
        defaultProps={{
          themeLabel: "Variété actuelle",
          trackCount: 60,
          coverImageUrls: SAMPLE_TRACKS.map((track) => track.albumCoverUrl),
          artistImageUrls: [
            "https://picsum.photos/seed/artist1/600",
            "https://picsum.photos/seed/artist2/600",
            "https://picsum.photos/seed/artist3/600",
            "https://picsum.photos/seed/artist4/600",
          ],
          accentColor: "#ff5f6d",
        }}
      />

      <Still
        id="ChannelBanner"
        component={ChannelBanner}
        width={CHANNEL_BANNER_WIDTH}
        height={CHANNEL_BANNER_HEIGHT}
      />

      <Still
        id="ChannelProfilePicture"
        component={ChannelProfilePicture}
        width={CHANNEL_PROFILE_SIZE}
        height={CHANNEL_PROFILE_SIZE}
      />
    </>
  );
}
