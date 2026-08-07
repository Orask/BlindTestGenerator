import type { CSSProperties, ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { BEAT_FRAMES, Beat } from "./Beat";
import { poppinsFontFamily as fontFamily } from "./fonts";

export interface OutroProps {
  readonly accentColor: string;
}

const textStyle: CSSProperties = {
  fontFamily,
  color: "white",
  textAlign: "center",
  padding: "0 120px",
};

export function Outro({ accentColor }: OutroProps): ReactElement {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
      <Audio src={staticFile("audio/intro-outro-music.mp3")} volume={0.7} />

      <Sequence durationInFrames={BEAT_FRAMES}>
        <Beat>
          <div style={{ ...textStyle, fontSize: 56, fontWeight: 800 }}>
            🔔 Abonne-toi pour ne rater aucun épisode !
          </div>
        </Beat>
      </Sequence>

      <Sequence from={BEAT_FRAMES} durationInFrames={BEAT_FRAMES}>
        <Beat>
          <div style={{ ...textStyle, fontSize: 52, fontWeight: 700, color: accentColor }}>
            À demain pour un nouveau thème ! 🎶
          </div>
        </Beat>
      </Sequence>
    </AbsoluteFill>
  );
}
