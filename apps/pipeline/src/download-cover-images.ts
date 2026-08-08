import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Downloads each unique cover image to a local file and returns a mapping
 * from the original URL to a local file:// URL. Remotion's <Img> loads
 * external images via a browser `load` event through delayRender() — that
 * hung indefinitely on Spotify's CDN in this environment even though the
 * same URL fetched instantly with curl, so covers are fetched up front and
 * rendered from disk instead (Remotion's own recommended pattern for
 * external/dynamic assets).
 */
export async function downloadCoverImages(
  urls: readonly string[],
  destDir: string,
): Promise<Map<string, string>> {
  await mkdir(destDir, { recursive: true });
  const uniqueUrls = [...new Set(urls)];
  const mapping = new Map<string, string>();

  for (const url of uniqueUrls) {
    const fileName = `${createHash("sha1").update(url).digest("hex")}.jpg`;
    const filePath = path.join(destDir, fileName);

    // The filename is a hash of the URL, so an existing file is guaranteed
    // to already hold that URL's content — skips a re-fetch when the
    // episode render and thumbnail render draw from the same cover set.
    const alreadyDownloaded = await access(filePath)
      .then(() => true)
      .catch(() => false);
    if (!alreadyDownloaded) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download cover image ${url}: ${response.status}`);
      }
      await writeFile(filePath, Buffer.from(await response.arrayBuffer()));
    }

    mapping.set(url, pathToFileURL(filePath).href);
  }

  return mapping;
}

/**
 * Same as downloadCoverImages, but returns root-relative URLs matching how
 * Remotion serves its public/ dir under a /public prefix in the bundled
 * server (confirmed by inspecting an actual bundle output dir — see
 * render-episode.ts), ready to use directly as an <Img src>.
 */
export async function resolvePublicCoverUrls(
  urls: readonly string[],
  destDir: string,
): Promise<Map<string, string>> {
  const localCovers = await downloadCoverImages(urls, destDir);
  const publicUrls = new Map<string, string>();
  for (const [url, localPath] of localCovers) {
    publicUrls.set(url, `/public/covers/${path.basename(localPath)}`);
  }
  return publicUrls;
}
