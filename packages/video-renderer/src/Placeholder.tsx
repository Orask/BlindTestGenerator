import type { ReactElement } from "react";
import { AbsoluteFill } from "remotion";

export function Placeholder(): ReactElement {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0d0d0d",
        color: "#f5f5f5",
        justifyContent: "center",
        alignItems: "center",
        fontSize: 48,
        fontFamily: "sans-serif",
      }}
    >
      BlindTestGenerator — composition à venir
    </AbsoluteFill>
  );
}
