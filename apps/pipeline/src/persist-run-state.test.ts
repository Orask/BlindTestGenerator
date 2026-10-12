import { afterEach, describe, expect, it, vi } from "vitest";
import type Database from "better-sqlite3";
import { persistRunState, type GitRunner } from "./persist-run-state.js";

function fakeDb(): { db: Database.Database; pragma: ReturnType<typeof vi.fn> } {
  const pragma = vi.fn();
  return { db: { pragma } as unknown as Database.Database, pragma };
}

describe("persistRunState", () => {
  const originalGithubActions = process.env.GITHUB_ACTIONS;

  afterEach(() => {
    process.env.GITHUB_ACTIONS = originalGithubActions;
  });

  it("does nothing outside CI, never touching git or checkpointing the db", async () => {
    delete process.env.GITHUB_ACTIONS;
    const { db, pragma } = fakeDb();
    const runGit = vi.fn();

    await persistRunState("/repo/data/blindtest.sqlite", db, "commit message", undefined, runGit);

    expect(runGit).not.toHaveBeenCalled();
    expect(pragma).not.toHaveBeenCalled();
  });

  it("checkpoints the db and commits+pushes when there are staged changes", async () => {
    process.env.GITHUB_ACTIONS = "true";
    const { db, pragma } = fakeDb();
    const runGit: GitRunner = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "" }) // add
      .mockResolvedValueOnce({ stdout: "data/blindtest.sqlite\n" }) // diff --cached
      .mockResolvedValueOnce({ stdout: "" }) // commit
      .mockResolvedValueOnce({ stdout: "" }); // push

    await persistRunState(
      "/repo/data/blindtest.sqlite",
      db,
      "chore(data): message",
      "/repo/channels/blindtest-fr.json",
      runGit,
    );

    expect(pragma).toHaveBeenCalledWith("wal_checkpoint(TRUNCATE)");
    expect(runGit).toHaveBeenCalledTimes(4);
    expect(runGit).toHaveBeenNthCalledWith(
      1,
      ["add", "/repo/data/blindtest.sqlite", "/repo/channels/blindtest-fr.json"],
      "/repo",
    );
    expect(runGit).toHaveBeenNthCalledWith(3, ["commit", "-m", "chore(data): message"], "/repo");
    expect(runGit).toHaveBeenNthCalledWith(4, ["push"], "/repo");
  });

  it("stages only the db path when no channel config path is given (a Short)", async () => {
    process.env.GITHUB_ACTIONS = "true";
    const { db } = fakeDb();
    const runGit: GitRunner = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "" })
      .mockResolvedValueOnce({ stdout: "data/blindtest.sqlite\n" })
      .mockResolvedValueOnce({ stdout: "" })
      .mockResolvedValueOnce({ stdout: "" });

    await persistRunState("/repo/data/blindtest.sqlite", db, "message", undefined, runGit);

    expect(runGit).toHaveBeenNthCalledWith(1, ["add", "/repo/data/blindtest.sqlite"], "/repo");
  });

  it("skips commit+push when nothing is actually staged", async () => {
    process.env.GITHUB_ACTIONS = "true";
    const { db } = fakeDb();
    const runGit: GitRunner = vi
      .fn()
      .mockResolvedValueOnce({ stdout: "" }) // add
      .mockResolvedValueOnce({ stdout: "" }); // diff --cached: nothing staged

    await persistRunState("/repo/data/blindtest.sqlite", db, "message", undefined, runGit);

    expect(runGit).toHaveBeenCalledTimes(2);
  });

  it("swallows a git failure instead of throwing (the end-of-job step is the backstop)", async () => {
    process.env.GITHUB_ACTIONS = "true";
    const { db } = fakeDb();
    const runGit: GitRunner = vi.fn().mockRejectedValue(new Error("git push failed: no network"));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      persistRunState("/repo/data/blindtest.sqlite", db, "message", undefined, runGit),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});
