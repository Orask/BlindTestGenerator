import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "./schema.js";
import { getCooldownUntil, setCooldownUntil } from "./service-cooldowns-repository.js";

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  db.exec(SCHEMA_SQL);
});

describe("service cooldowns", () => {
  const now = new Date("2026-09-24T12:00:00Z");

  it("returns null when no cooldown was ever recorded", () => {
    expect(getCooldownUntil(db, "spotify", now)).toBeNull();
  });

  it("returns the recorded cooldown while it is still in the future", () => {
    const until = new Date("2026-09-24T18:00:00Z");
    setCooldownUntil(db, "spotify", until);

    expect(getCooldownUntil(db, "spotify", now)).toEqual(until);
  });

  it("returns null once the cooldown has expired", () => {
    setCooldownUntil(db, "spotify", new Date("2026-09-24T11:59:59Z"));

    expect(getCooldownUntil(db, "spotify", now)).toBeNull();
  });

  it("overwrites an earlier cooldown for the same service, leaving others alone", () => {
    setCooldownUntil(db, "spotify", new Date("2026-09-24T13:00:00Z"));
    setCooldownUntil(db, "other", new Date("2026-09-24T14:00:00Z"));
    setCooldownUntil(db, "spotify", new Date("2026-09-25T00:00:00Z"));

    expect(getCooldownUntil(db, "spotify", now)).toEqual(new Date("2026-09-25T00:00:00Z"));
    expect(getCooldownUntil(db, "other", now)).toEqual(new Date("2026-09-24T14:00:00Z"));
  });
});
