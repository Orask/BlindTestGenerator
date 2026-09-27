import type { ReactElement } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { ringProgress, secondsRemaining } from "./countdown-math";
import { baloo2FontFamily as fontFamily } from "./fonts";

// Tuned for the 16:9 Episode composition's 1080px-tall canvas. The vertical
// Short composition (1920px tall) passes a larger `size` so the ring fills
// more of that extra height instead of floating in empty space — stroke
// width and digit size scale with it (proportions below match this default).
const DEFAULT_RING_SIZE = 340;
const RING_STROKE_RATIO = 18 / DEFAULT_RING_SIZE;
const RING_FONT_RATIO = 130 / DEFAULT_RING_SIZE;
const GLOW_SIZE_RATIO = 520 / DEFAULT_RING_SIZE;
const GLOW_SIZE_MIN_RATIO = 420 / DEFAULT_RING_SIZE;

export interface CountdownRingProps {
  readonly durationInFrames: number;
  readonly accentColor: string;
  /** Ring diameter in px — defaults to the long-form Episode's size, unchanged. */
  readonly size?: number;
}

export function CountdownRing({
  durationInFrames,
  accentColor,
  size = DEFAULT_RING_SIZE,
}: CountdownRingProps): ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const ringStroke = size * RING_STROKE_RATIO;
  const ringRadius = (size - ringStroke) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;

  const progress = ringProgress(frame, durationInFrames);
  const remaining = secondsRemaining(frame, fps, durationInFrames);

  // Re-triggers every second: a quick pulse-down on each tick, plus a soft
  // glow behind the ring that breathes with it — the "less empty" ask.
  const framesIntoSecond = frame % fps;
  const pop = spring({ frame: framesIntoSecond, fps, config: { damping: 12, stiffness: 220 } });
  const scale = 1 + 0.12 * (1 - pop);
  const glowSize = interpolate(pop, [0, 1], [size * GLOW_SIZE_RATIO, size * GLOW_SIZE_MIN_RATIO]);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
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
        width={size}
        height={size}
        style={{ position: "relative", transform: `scale(${scale})`, overflow: "visible" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={ringRadius}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={ringStroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={ringRadius}
          fill="none"
          stroke={accentColor}
          strokeWidth={ringStroke}
          strokeLinecap="round"
          strokeDasharray={ringCircumference}
          strokeDashoffset={ringCircumference * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={size * RING_FONT_RATIO}
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
