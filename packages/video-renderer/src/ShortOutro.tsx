import type { CSSProperties, ReactElement } from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { baloo2FontFamily, poppinsFontFamily } from "./fonts";

export const SHORT_OUTRO_FRAMES = 120; // 4s at 30fps.

export interface ShortOutroProps {
  readonly fullEpisodeTrackCount: number;
  readonly accentColor: string;
}

const textStyle: CSSProperties = {
  fontFamily: poppinsFontFamily,
  color: "white",
  textAlign: "center",
  padding: "0 64px",
};

export function ShortOutro({ fullEpisodeTrackCount, accentColor }: ShortOutroProps): ReactElement {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d0d0d",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Audio src={staticFile("audio/intro-outro-music.mp3")} volume={0.7} />
      <div style={{ ...textStyle, fontFamily: baloo2FontFamily, fontSize: 64, fontWeight: 800 }}>
        L'épisode complet
        <div style={{ color: accentColor, marginTop: 8 }}>{fullEpisodeTrackCount} morceaux</div>
      </div>
      <div style={{ ...textStyle, fontSize: 48, fontWeight: 700, marginTop: 48 }}>
        👉 sur la chaîne
      </div>
      <div
        style={{ ...textStyle, fontSize: 44, fontWeight: 700, marginTop: 24, color: accentColor }}
      >
        🔔 Abonne-toi !
      </div>
    </AbsoluteFill>
  );
}
