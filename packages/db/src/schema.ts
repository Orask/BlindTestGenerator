export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'unlisted', 'public'))
);

-- seedArtists lives in the channel's JSON config file, not here — this table
-- only exists to satisfy foreign keys from tracks_used/videos and to persist
-- the YouTube playlist id once created (the DB is the source of truth for
-- that; the JSON config's youtubePlaylistId is just a static placeholder).
CREATE TABLE IF NOT EXISTS channel_themes (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  day TEXT NOT NULL,
  label TEXT NOT NULL,
  youtube_playlist_id TEXT
);

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  theme_id TEXT NOT NULL REFERENCES channel_themes(id),
  created_at TEXT NOT NULL,
  file_path TEXT,
  youtube_video_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'uploaded', 'failed')),
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'unlisted', 'public')),
  format TEXT NOT NULL CHECK (format IN ('long', 'short'))
);

-- Anti-repeat is enforced at the application layer (see
-- apps/pipeline/src/build-episode-tracks.ts): a track can be reused once a
-- cooldown window has passed, capped to a small number per episode, so a
-- track CAN legitimately show up more than once here over time — a
-- surrogate id replaces the old (channel_id, spotify_track_id) primary key,
-- which used to forbid any repeat, ever.
CREATE TABLE IF NOT EXISTS tracks_used (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  theme_id TEXT NOT NULL REFERENCES channel_themes(id),
  spotify_track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  used_at TEXT NOT NULL,
  video_id TEXT REFERENCES videos(id)
);

-- Persists an external API's rate-limit cooldown (e.g. Spotify's 429
-- Retry-After) across runs: the DB is committed back after every scheduled
-- run, so the next run can refuse to hit a still-cooling-down API instead of
-- rediscovering the block (and possibly extending it) with fresh requests.
CREATE TABLE IF NOT EXISTS service_cooldowns (
  service TEXT PRIMARY KEY,
  blocked_until TEXT NOT NULL
);

-- A track that got a YouTube Content ID claim serious enough to block a
-- published video (confirmed live: two tracks made a whole episode
-- unwatchable worldwide) is excluded from every future selection, across
-- every theme — the claim is on the recording itself, not the theme or
-- channel, so there is no reason to ever risk it again. YouTube doesn't
-- expose Content ID claim details via the public Data API (that requires
-- CMS/partner access this project doesn't have), so a human still has to
-- read the claim off YouTube Studio and report which track it was — this
-- table is just the permanent memory of that manual finding.
CREATE TABLE IF NOT EXISTS blocked_tracks (
  spotify_track_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  reason TEXT NOT NULL,
  blocked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_used_channel_track
  ON tracks_used(channel_id, spotify_track_id);
`;
