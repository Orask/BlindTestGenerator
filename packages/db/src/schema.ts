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
  -- Which channel's video the claim was actually found on — audit trail for
  -- a future multi-channel setup, not a scoping key: getBlockedTrackIds()
  -- deliberately stays unscoped (see the comment above this table), since
  -- the claim is on the recording itself and a second channel uploading the
  -- same track would risk it just as much.
  channel_id TEXT NOT NULL REFERENCES channels(id),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  reason TEXT NOT NULL,
  blocked_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracks_used_channel_track
  ON tracks_used(channel_id, spotify_track_id);

-- iTunes Search has no concept of "this exact recording" the way Spotify
-- does — only a (title, artist) text search — so the cache key is the
-- same normalized pair every lookup already uses to match results
-- (apps/pipeline/src/itunes-preview-cache.ts), not a track id. Not scoped
-- to a channel: the same song resolves to the same iTunes preview
-- regardless of which channel is asking, so caching it once benefits every
-- channel that ever picks that song — the whole point once more than one
-- channel shares this database (see docs/CAHIER_DES_CHARGES.md's
-- scalability notes). preview_url is nullable: a confirmed "no preview
-- found" is cached too, so a track with no preview doesn't get re-queried
-- by every future episode that happens to try it again.
CREATE TABLE IF NOT EXISTS itunes_preview_cache (
  cache_key TEXT PRIMARY KEY,
  preview_url TEXT,
  cached_at TEXT NOT NULL
);

-- A theme's episode is still rebuilt live from Spotify/iTunes every run
-- (2026-10-22: this caused several real incidents — a curatedTrack typo or
-- a Live-only version fails its Spotify search identically on every future
-- run with no memory of it, and a candidate's eventual iTunes-preview
-- outcome is likewise never recorded against the candidate itself). This
-- table is step 1 of migrating toward a persistent per-theme catalog: it is
-- written to in parallel with today's live collection (shadow-write only,
-- see apps/pipeline/src/pipeline.ts), without yet being read from — the
-- live path keeps deciding what gets selected until the catalog has had
-- time to prove it mirrors reality.
CREATE TABLE IF NOT EXISTS catalog_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  theme_id TEXT NOT NULL REFERENCES channel_themes(id),
  spotify_track_id TEXT NOT NULL,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  artist_names TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('seed_artist', 'curated', 'discovered')),
  status TEXT NOT NULL CHECK (status IN ('discovered', 'verified', 'audio_ready', 'ineligible', 'blocked'))
    DEFAULT 'discovered',
  ineligible_reason TEXT,
  cache_key TEXT NOT NULL,
  discovered_at TEXT NOT NULL,
  verified_at TEXT,
  audio_checked_at TEXT,
  UNIQUE (theme_id, spotify_track_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_tracks_theme_status
  ON catalog_tracks(theme_id, status);

-- Remembers a curatedTrack (title, artist) pair's Spotify search outcome —
-- specifically the "introuvable" (not_found) and "rejected as a
-- Live/remix/feat version" (rejected_version) cases, which today fail
-- silently and identically every single run (see collect-curated-tracks.ts
-- and NON_ORIGINAL_VERSION_PATTERN in @blindtest/spotify's client.ts).
-- Keyed and shared the same way itunes_preview_cache is (normalized
-- title|artist, not scoped to a channel): the same pair fails or resolves
-- to the same Spotify track regardless of which theme or channel asks.
CREATE TABLE IF NOT EXISTS spotify_resolution_cache (
  cache_key TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('resolved', 'not_found', 'rejected_version')),
  spotify_track_id TEXT,
  checked_at TEXT NOT NULL
);
`;
