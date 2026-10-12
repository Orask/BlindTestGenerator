import { execFile } from "node:child_process";
import { dirname } from "node:path";
import { promisify } from "node:util";
import type Database from "better-sqlite3";

const execFileAsync = promisify(execFile);

/** Runs `git` with the given args in `cwd` and returns stdout — swapped out in tests. */
export type GitRunner = (args: readonly string[], cwd: string) => Promise<{ stdout: string }>;

const runGitViaChildProcess: GitRunner = (args, cwd) => execFileAsync("git", [...args], { cwd });

/**
 * Commits and pushes the sqlite DB (and the channel config, which discovery
 * may have appended new artists to) right after a video goes live — not
 * just at the end of the CI job. A run that times out or crashes between a
 * successful YouTube upload and the job's trailing "Persist database state"
 * step otherwise loses that episode's row forever: the video stays live on
 * YouTube but the DB never learns about it (confirmed live for "Rap FR
 * Ép.1" and "Variété actuelle Ép.7" — see docs/CAHIER_DES_CHARGES.md).
 *
 * CI-only (gated on GITHUB_ACTIONS) — a local run has no credential helper
 * configured for the remote and must never auto-commit/push on its own.
 * Any failure here is swallowed: the end-of-job persist step in the
 * workflow YAML still runs as a backstop either way, so this is a
 * best-effort head start, not something worth failing an already-published
 * episode's run over.
 */
export async function persistRunState(
  dbPath: string,
  db: Database.Database,
  commitMessage: string,
  /** Omitted for a Short, which never writes to a channel config. */
  channelConfigPath?: string,
  runGit: GitRunner = runGitViaChildProcess,
): Promise<void> {
  if (process.env.GITHUB_ACTIONS !== "true") {
    return;
  }

  try {
    db.pragma("wal_checkpoint(TRUNCATE)");

    const repoRoot = dirname(dirname(dbPath));
    const paths = [dbPath, ...(channelConfigPath ? [channelConfigPath] : [])];

    await runGit(["add", ...paths], repoRoot);
    const { stdout } = await runGit(["diff", "--cached", "--name-only"], repoRoot);
    if (stdout.trim().length === 0) {
      return;
    }

    await runGit(["commit", "-m", commitMessage], repoRoot);
    await runGit(["push"], repoRoot);
  } catch (error) {
    console.warn(
      `Échec de la sauvegarde immédiate de l'état (le backstop de fin de job la retentera) : ${(error as Error).message}`,
    );
  }
}
