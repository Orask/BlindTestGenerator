import { loadFont } from "@remotion/google-fonts/Poppins";
import type { CSSProperties, ReactElement } from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { BEAT_FRAMES, Beat } from "./Beat";

const { fontFamily } = loadFont();

export interface IntroProps {
  readonly themeLabel: string;
  readonly trackCount: number;
  readonly secondsPerTrack: number;
  readonly accentColor: string;
}

const textStyle: CSSProperties = {
  fontFamily,
  color: "white",
  textAlign: "center",
  padding: "0 120px",
};

export function Intro({
  themeLabel,
  trackCount,
  secondsPerTrack,
  accentColor,
}: IntroProps): ReactElement {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0d0d0d" }}>
      <Audio src={staticFile("audio/intro-outro-music.mp3")} volume={0.7} />

      <Sequence durationInFrames={BEAT_FRAMES}>
        <Beat>
          <div style={{ ...textStyle, fontSize: 88, fontWeight: 800 }}>
            🎧 BLIND TEST
            <div style={{ fontSize: 56, color: accentColor, marginTop: 12 }}>{themeLabel}</div>
          </div>
        </Beat>
      </Sequence>

      <Sequence from={BEAT_FRAMES} durationInFrames={BEAT_FRAMES}>
        <Beat>
          <div style={{ ...textStyle, fontSize: 52, fontWeight: 700, lineHeight: 1.6 }}>
            <div>{trackCount} morceaux à deviner</div>
            <div>{secondsPerTrack} secondes chrono par morceau</div>
          </div>
        </Beat>
      </Sequence>

      <Sequence from={BEAT_FRAMES * 2} durationInFrames={BEAT_FRAMES}>
        <Beat>
          <div style={{ ...textStyle, fontSize: 44, fontWeight: 700, lineHeight: 1.8 }}>
            <div>🎯 +1 point si tu trouves le titre</div>
            <div style={{ color: accentColor }}>🌟 +1 point bonus si tu trouves l'artiste</div>
          </div>
        </Beat>
      </Sequence>

      <Sequence from={BEAT_FRAMES * 3} durationInFrames={BEAT_FRAMES}>
        <Beat>
          <div style={{ ...textStyle, fontSize: 56, fontWeight: 800 }}>
            🔔 Abonne-toi pour ne rater aucun épisode !
          </div>
        </Beat>
      </Sequence>
    </AbsoluteFill>
  );
}
