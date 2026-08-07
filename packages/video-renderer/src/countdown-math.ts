/** Whole seconds left to display, counting 10..1 (never 0 — the reveal takes over right after). */
export function secondsRemaining(frame: number, fps: number, countdownFrames: number): number {
  const totalSeconds = countdownFrames / fps;
  const elapsedSeconds = Math.floor(frame / fps);
  return Math.max(1, totalSeconds - elapsedSeconds);
}

/** Fraction of the ring still "full", from 1 (start) down to ~0 (end of countdown). */
export function ringProgress(frame: number, countdownFrames: number): number {
  return Math.min(1, Math.max(0, 1 - frame / countdownFrames));
}
