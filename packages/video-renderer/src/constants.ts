export const FPS = 30;
export const COUNTDOWN_SECONDS = 12;
export const REVEAL_SECONDS = 5;
export const COUNTDOWN_FRAMES = FPS * COUNTDOWN_SECONDS;
export const REVEAL_FRAMES = FPS * REVEAL_SECONDS;
export const SEGMENT_FRAMES = COUNTDOWN_FRAMES + REVEAL_FRAMES;

// Shorts-only pacing, deliberately NOT the long-form Episode's 17s/track —
// confirmed live (YouTube Analytics, 2026-10-12): the long-form pacing
// reused wholesale for Shorts underperformed badly (most got under 20
// views), while viewers explicitly expect short-form content to be fast
// and to-the-point. 6 tracks x 5s keeps the Short dynamic instead of a
// slow-motion copy of the long-form guessing game — see Short.tsx.
export const SHORT_COUNTDOWN_SECONDS = 3;
export const SHORT_REVEAL_SECONDS = 2;
export const SHORT_COUNTDOWN_FRAMES = FPS * SHORT_COUNTDOWN_SECONDS;
export const SHORT_REVEAL_FRAMES = FPS * SHORT_REVEAL_SECONDS;
export const SHORT_SEGMENT_FRAMES = SHORT_COUNTDOWN_FRAMES + SHORT_REVEAL_FRAMES;

export const INTRO_SECONDS = 12;
export const OUTRO_SECONDS = 9;
export const INTRO_FRAMES = FPS * INTRO_SECONDS;
export const OUTRO_FRAMES = FPS * OUTRO_SECONDS;

// How long each track's audio fades in/out at its edges, extended past its
// own segment boundary so it overlaps with the neighboring track's fade —
// a real crossfade instead of a hard cut.
export const CROSSFADE_SECONDS = 0.2;
export const CROSSFADE_FRAMES = Math.round(FPS * CROSSFADE_SECONDS);
