import type { ReactElement } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ringProgress, secondsRemaining } from "./countdown-math";
import { baloo2FontFamily as fontFamily } from "./fonts";

const RING_SIZE = 340;
const RING_STROKE = 18;
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

  // Re-triggers every second: a quick pulse-down on each tick, plus a soft
  // glow behind the ring that breathes with it — the "less empty" ask.
  const framesIntoSecond = frame % fps;
  const pop = spring({ frame: framesIntoSecond, fps, config: { damping: 12, stiffness: 220 } });
  const scale = 1 + 0.12 * (1 - pop);
  const glowSize = interpolate(pop, [0, 1], [520, 420]);

  return (
    <div style={{ position: "relative", width: RING_SIZE, height: RING_SIZE }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: glowSize,
          height: glowSize,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentColor}40 0%, transparent 70%)`,
        }}
      />
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        style={{ position: "relative", transform: `scale(${scale})`, overflow: "visible" }}
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
          fontSize={130}
          fontWeight={700}
          fontFamily={fontFamily}
          fill="white"
        >
          {remaining}
        </text>
      </svg>
    </div>
  );
}
