import type { CSSProperties, ReactElement } from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { baloo2FontFamily, poppinsFontFamily } from "./fonts";

export const SHORT_OUTRO_FRAMES = 120; // 4s at 30fps.

export interface ShortOutroProps {
  /**
   * Omitted for a Short that doesn't tease a specific already-published
   * episode (see apps/pipeline/src/shorts/ — the "traffic" Short types
   * pick a track that was never used in any episode, so there's no "full
   * episode" to point to).
   */
  readonly fullEpisodeTrackCount?: number;
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
      {fullEpisodeTrackCount !== undefined ? (
        <div style={{ ...textStyle, fontFamily: baloo2FontFamily, fontSize: 64, fontWeight: 800 }}>
          L'épisode complet
          <div style={{ color: accentColor, marginTop: 8 }}>{fullEpisodeTrackCount} morceaux</div>
        </div>
      ) : (
        <div style={{ ...textStyle, fontFamily: baloo2FontFamily, fontSize: 60, fontWeight: 800 }}>
          Un nouveau
          <div style={{ color: accentColor, marginTop: 8 }}>Blind Test chaque jour</div>
        </div>
      )}
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
