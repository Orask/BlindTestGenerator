import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadCoverImages } from "./download-cover-images.js";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "blindtest-covers-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("downloadCoverImages", () => {
  it("downloads each unique URL once and maps it to a local file:// URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new TextEncoder().encode("fake-image-bytes").buffer),
    });
    vi.stubGlobal("fetch", fetchMock);

    const urls = [
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
      "https://example.com/a.jpg",
    ];
    const mapping = await downloadCoverImages(urls, dir);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(mapping.size).toBe(2);

    const localUrlForA = mapping.get("https://example.com/a.jpg")!;
    expect(localUrlForA.startsWith("file://")).toBe(true);
    const content = await readFile(fileURLToPath(localUrlForA), "utf-8");
    expect(content).toBe("fake-image-bytes");

    const files = await readdir(dir);
    expect(files).toHaveLength(2);

    vi.unstubAllGlobals();
  });

  it("throws when a download fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(downloadCoverImages(["https://example.com/missing.jpg"], dir)).rejects.toThrow(
      "Failed to download cover image",
    );

    vi.unstubAllGlobals();
  });
});
