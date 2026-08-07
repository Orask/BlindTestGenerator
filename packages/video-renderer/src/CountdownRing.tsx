import type { ReactElement } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ringProgress, secondsRemaining } from "./countdown-math";

const RING_SIZE = 320;
const RING_STROKE = 16;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export interface CountdownRingProps {
  readonly durationInFrames: number;
  readonly accentColor: string;
}

export function CountdownRing({ durationInFrames, accentColor }: CountdownRingProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = ringProgress(frame, durationInFrames);
  const remaining = secondsRemaining(frame, fps, durationInFrames);

  // Re-triggers every second: a quick pulse-down on each tick.
  const framesIntoSecond = frame % fps;
  const pop = spring({ frame: framesIntoSecond, fps, config: { damping: 12, stiffness: 220 } });
  const scale = 1 + 0.12 * (1 - pop);

  return (
    <svg
      width={RING_SIZE}
      height={RING_SIZE}
      style={{ transform: `scale(${scale})`, overflow: "visible" }}
    >
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={RING_STROKE}
      />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke={accentColor}
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={RING_CIRCUMFERENCE}
        strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={120}
        fontWeight={700}
        fontFamily="sans-serif"
        fill="white"
      >
        {remaining}
      </text>
    </svg>
  );
}
