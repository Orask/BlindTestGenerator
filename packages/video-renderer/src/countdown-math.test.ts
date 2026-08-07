import { describe, expect, it } from "vitest";
import { ringProgress, secondsRemaining } from "./countdown-math";

describe("secondsRemaining", () => {
  it("shows the full count at the very first frame", () => {
    expect(secondsRemaining(0, 30, 300)).toBe(10);
  });

  it("stays on the same second until the second boundary", () => {
    expect(secondsRemaining(29, 30, 300)).toBe(10);
    expect(secondsRemaining(30, 30, 300)).toBe(9);
  });

  it("never drops to 0 or below during the countdown", () => {
    expect(secondsRemaining(299, 30, 300)).toBe(1);
    expect(secondsRemaining(300, 30, 300)).toBe(1);
  });
});

describe("ringProgress", () => {
  it("starts full at frame 0", () => {
    expect(ringProgress(0, 300)).toBe(1);
  });

  it("decreases linearly with elapsed frames", () => {
    expect(ringProgress(150, 300)).toBeCloseTo(0.5);
  });

  it("clamps to 0 once the countdown is over", () => {
    expect(ringProgress(300, 300)).toBe(0);
    expect(ringProgress(999, 300)).toBe(0);
  });
});
