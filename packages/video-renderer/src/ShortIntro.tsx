import type { CSSProperties, ReactElement } from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { baloo2FontFamily, poppinsFontFamily } from "./fonts";

export const SHORT_INTRO_FRAMES = 75; // 2.5s at 30fps — a Short lives or dies in its first 2-3s, no time for a multi-beat rules explainer.

export interface ShortIntroProps {
  readonly themeLabel: string;
  readonly secondsPerTrack: number;
  readonly accentColor: string;
}

const textStyle: CSSProperties = {
  fontFamily: poppinsFontFamily,
  color: "white",
  textAlign: "center",
  padding: "0 64px",
};

export function ShortIntro({
  themeLabel,
  secondsPerTrack,
  accentColor,
}: ShortIntroProps): ReactElement {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d0d0d",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Audio src={staticFile("audio/intro-outro-music.mp3")} volume={0.7} />
      <div style={{ ...textStyle, fontFamily: baloo2FontFamily, fontSize: 96, fontWeight: 800 }}>
        🎧 BLIND TEST
      </div>
      <div
        style={{
          ...textStyle,
          fontSize: 60,
          fontWeight: 700,
          color: accentColor,
          marginTop: 16,
        }}
      >
        {themeLabel}
      </div>
      <div style={{ ...textStyle, fontSize: 40, fontWeight: 600, marginTop: 40, opacity: 0.9 }}>
        {secondsPerTrack}s chrono par morceau ⏱️
      </div>
    </AbsoluteFill>
  );
}
