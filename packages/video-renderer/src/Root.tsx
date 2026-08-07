import type { ReactElement } from "react";
import { Composition } from "remotion";
import { Placeholder } from "./Placeholder.js";

export function RemotionRoot(): ReactElement {
  return (
    <Composition
      id="Placeholder"
      component={Placeholder}
      durationInFrames={15 * 30}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
