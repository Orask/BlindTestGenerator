export const FPS = 30;
export const COUNTDOWN_SECONDS = 12;
export const REVEAL_SECONDS = 5;
export const COUNTDOWN_FRAMES = FPS * COUNTDOWN_SECONDS;
export const REVEAL_FRAMES = FPS * REVEAL_SECONDS;
export const SEGMENT_FRAMES = COUNTDOWN_FRAMES + REVEAL_FRAMES;

export const INTRO_SECONDS = 12;
export const OUTRO_SECONDS = 9;
export const INTRO_FRAMES = FPS * INTRO_SECONDS;
export const OUTRO_FRAMES = FPS * OUTRO_SECONDS;

// How long each track's audio fades in/out at its edges, extended past its
// own segment boundary so it overlaps with the neighboring track's fade —
// a real crossfade instead of a hard cut.
export const CROSSFADE_SECONDS = 0.2;
export const CROSSFADE_FRAMES = Math.round(FPS * CROSSFADE_SECONDS);
