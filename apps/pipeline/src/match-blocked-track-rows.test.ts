import { describe, expect, it } from "vitest";
import { matchBlockedTrackRows, type TrackRow } from "./match-blocked-track-rows.js";

const trackRows: TrackRow[] = [
  { spotify_track_id: "id-1", title: "Avant toi", artist: "Vitaa, Slimane" },
  { spotify_track_id: "id-2", title: "Reine", artist: "Dadju" },
  { spotify_track_id: "id-3", title: "Ella, elle l'a", artist: "France Gall" },
];

describe("matchBlockedTrackRows", () => {
  it("matches a spec by exact title and exact artist", () => {
    const result = matchBlockedTrackRows(trackRows, [{ title: "Reine", artist: "Dadju" }]);
    expect(result).toEqual([trackRows[1]]);
  });

  it("matches a spec whose artist is a substring of a multi-artist credit", () => {
    const result = matchBlockedTrackRows(trackRows, [{ title: "Avant toi", artist: "Vitaa" }]);
    expect(result).toEqual([trackRows[0]]);
  });

  it("matches ignoring diacritics and case", () => {
    const result = matchBlockedTrackRows(trackRows, [
      { title: "ella, elle l'a", artist: "FRANCE GALL" },
    ]);
    expect(result).toEqual([trackRows[2]]);
  });

  it("resolves multiple specs in order", () => {
    const result = matchBlockedTrackRows(trackRows, [
      { title: "Reine", artist: "Dadju" },
      { title: "Avant toi", artist: "Slimane" },
    ]);
    expect(result).toEqual([trackRows[1], trackRows[0]]);
  });

  it("throws when a spec matches no track", () => {
    expect(() =>
      matchBlockedTrackRows(trackRows, [{ title: "Nonexistent", artist: "Nobody" }]),
    ).toThrow('0 correspondance(s) pour "Nonexistent" — Nobody (attendu : exactement 1)');
  });

  it("throws when a spec's title matches more than one track", () => {
    const ambiguousRows: TrackRow[] = [
      { spotify_track_id: "id-1", title: "Reine", artist: "Dadju" },
      { spotify_track_id: "id-2", title: "Reine", artist: "Angèle" },
    ];

    expect(() => matchBlockedTrackRows(ambiguousRows, [{ title: "Reine", artist: "" }])).toThrow(
      '2 correspondance(s) pour "Reine" —  (attendu : exactement 1)',
    );
  });
});
