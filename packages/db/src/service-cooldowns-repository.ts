import type Database from "better-sqlite3";

/** The moment the service is usable again, or null if it has no recorded cooldown (or it already expired). */
export function getCooldownUntil(
  db: Database.Database,
  service: string,
  now: Date = new Date(),
): Date | null {
  const row = db
    .prepare<[string], { blocked_until: string }>(
      "SELECT blocked_until FROM service_cooldowns WHERE service = ?",
    )
    .get(service);
  if (!row) {
    return null;
  }
  const until = new Date(row.blocked_until);
  return until.getTime() > now.getTime() ? until : null;
}

export function setCooldownUntil(db: Database.Database, service: string, until: Date): void {
  db.prepare(
    `INSERT INTO service_cooldowns (service, blocked_until) VALUES (?, ?)
     ON CONFLICT (service) DO UPDATE SET blocked_until = excluded.blocked_until`,
  ).run(service, until.toISOString());
}
