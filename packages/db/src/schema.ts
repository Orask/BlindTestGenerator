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

CREATE INDEX IF NOT EXISTS idx_tracks_used_channel_track
  ON tracks_used(channel_id, spotify_track_id);
`;
