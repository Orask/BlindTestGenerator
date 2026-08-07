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

-- The (channel_id, spotify_track_id) primary key enforces the anti-repeat
-- rule at the storage layer: a track can never be recorded twice for the
-- same channel, regardless of which theme it was used under.
CREATE TABLE IF NOT EXISTS tracks_used (
  channel_id TEXT NOT NULL REFERENCES channels(id),
  theme_id TEXT NOT NULL REFERENCES channel_themes(id),
  spotify_track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  used_at TEXT NOT NULL,
  video_id TEXT REFERENCES videos(id),
  PRIMARY KEY (channel_id, spotify_track_id)
);
`;
